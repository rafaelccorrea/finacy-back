import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'finacy_user',
    password: process.env.DB_PASSWORD || 'finacy_password',
    database: process.env.DB_NAME || 'finacy_db',
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
    autoLoadEntities: true,
  }),
);
