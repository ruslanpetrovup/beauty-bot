const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { S3 } = require('aws-sdk');
const db = require('../database/db');

class BackupService {
    constructor() {
        this.s3 = new S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION
        });
        
        this.backupDir = path.join(__dirname, '../../backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir);
        }
    }

    async createBackup() {
        const timestamp = moment().format('YYYY-MM-DD_HH-mm');
        const filename = `backup_${timestamp}.sql`;
        const filepath = path.join(this.backupDir, filename);

        try {
            // Создаем дамп базы данных
            await this.createDatabaseDump(filepath);

            // Загружаем в S3
            await this.uploadToS3(filepath, filename);

            // Записываем информацию о бэкапе
            await this.logBackup(filename);

            // Удаляем старые локальные бэкапы
            await this.cleanupOldBackups();

            return filename;
        } catch (error) {
            console.error('Backup creation error:', error);
            throw new Error('Ошибка создания резервной копии');
        }
    }

    async restoreFromBackup(filename) {
        try {
            // Скачиваем файл из S3
            const filepath = path.join(this.backupDir, filename);
            await this.downloadFromS3(filename, filepath);

            // Восстанавливаем базу данных
            await this.restoreDatabase(filepath);

            // Записываем информацию о восстановлении
            await this.logRestore(filename);

            return true;
        } catch (error) {
            console.error('Backup restoration error:', error);
            throw new Error('Ошибка восстановления из резервной копии');
        }
    }

    createDatabaseDump(filepath) {
        return new Promise((resolve, reject) => {
            const command = `pg_dump -U ${process.env.DB_USER} -h ${process.env.DB_HOST} ${process.env.DB_NAME} > ${filepath}`;
            
            exec(command, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    restoreDatabase(filepath) {
        return new Promise((resolve, reject) => {
            const command = `psql -U ${process.env.DB_USER} -h ${process.env.DB_HOST} ${process.env.DB_NAME} < ${filepath}`;
            
            exec(command, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async uploadToS3(filepath, filename) {
        const fileContent = fs.readFileSync(filepath);

        const params = {
            Bucket: process.env.AWS_BACKUP_BUCKET,
            Key: `backups/${filename}`,
            Body: fileContent
        };

        return this.s3.upload(params).promise();
    }

    async downloadFromS3(filename, filepath) {
        const params = {
            Bucket: process.env.AWS_BACKUP_BUCKET,
            Key: `backups/${filename}`
        };

        const data = await this.s3.getObject(params).promise();
        fs.writeFileSync(filepath, data.Body);
    }

    async logBackup(filename) {
        const query = `
            INSERT INTO backup_logs (
                filename,
                type,
                status,
                created_at
            )
            VALUES ($1, 'backup', 'success', NOW())
        `;

        return db.query(query, [filename]);
    }

    async logRestore(filename) {
        const query = `
            INSERT INTO backup_logs (
                filename,
                type,
                status,
                created_at
            )
            VALUES ($1, 'restore', 'success', NOW())
        `;

        return db.query(query, [filename]);
    }

    async cleanupOldBackups() {
        // Удаляем локальные файлы старше 7 дней
        const files = fs.readdirSync(this.backupDir);
        const now = moment();

        for (const file of files) {
            const filepath = path.join(this.backupDir, file);
            const stats = fs.statSync(filepath);
            const fileAge = moment().diff(moment(stats.mtime), 'days');

            if (fileAge > 7) {
                fs.unlinkSync(filepath);
            }
        }
    }

    async getBackupsList() {
        const query = `
            SELECT 
                filename,
                type,
                status,
                created_at
            FROM backup_logs
            ORDER BY created_at DESC
            LIMIT 10
        `;

        return db.query(query);
    }
}

module.exports = new BackupService(); 