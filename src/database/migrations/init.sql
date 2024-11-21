-- Таблица пользователей
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    "current_role" VARCHAR(10) DEFAULT 'client',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица ролей пользователей
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    "role_type" VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_type)
);

-- Таблица мастеров
CREATE TABLE masters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    salon_name VARCHAR(100),
    address TEXT,
    payment_details JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица категорий услуг
CREATE TABLE service_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица услуг
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES service_categories(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица временных слотов
CREATE TABLE time_slots (
    id SERIAL PRIMARY KEY,
    master_id INTEGER REFERENCES masters(id),
    start_time TIMESTAMP NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица записей
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES users(id),
    master_id INTEGER REFERENCES masters(id),
    service_id INTEGER REFERENCES services(id),
    time_slot_id INTEGER REFERENCES time_slots(id),
    status VARCHAR(20) DEFAULT 'pending',
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица услуг мастеров
CREATE TABLE master_services (
    id SERIAL PRIMARY KEY,
    master_id INTEGER REFERENCES masters(id),
    service_id INTEGER REFERENCES services(id),
    price DECIMAL(10,2) NOT NULL,
    duration INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(master_id, service_id)
);