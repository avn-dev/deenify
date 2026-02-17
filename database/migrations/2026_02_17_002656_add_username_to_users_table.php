<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::transaction(function () {
                DB::statement(<<<'SQL'
CREATE TABLE users_new (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NULL UNIQUE,
    email_verified_at DATETIME NULL,
    password TEXT NULL,
    providers TEXT NULL,
    kdf_salt TEXT NULL,
    kdf_params TEXT NULL,
    encrypted_dek TEXT NULL,
    dek_iv TEXT NULL,
    profile_ciphertext TEXT NULL,
    profile_iv TEXT NULL,
    remember_token TEXT NULL,
    two_factor_secret TEXT NULL,
    two_factor_recovery_codes TEXT NULL,
    two_factor_confirmed_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL
);
SQL);

                DB::statement(<<<'SQL'
INSERT INTO users_new (
    id,
    username,
    email,
    email_verified_at,
    password,
    providers,
    kdf_salt,
    kdf_params,
    encrypted_dek,
    dek_iv,
    profile_ciphertext,
    profile_iv,
    remember_token,
    two_factor_secret,
    two_factor_recovery_codes,
    two_factor_confirmed_at,
    created_at,
    updated_at
)
SELECT
    id,
    CASE
        WHEN email IS NOT NULL AND instr(email, '@') > 1 THEN lower(replace(replace(substr(email, 1, instr(email, '@') - 1), '.', '_'), '+', '_'))
        WHEN email IS NOT NULL THEN lower(replace(replace(email, '.', '_'), '+', '_'))
        ELSE 'user_' || substr(id, 1, 8)
    END AS username,
    email,
    email_verified_at,
    password,
    providers,
    kdf_salt,
    kdf_params,
    encrypted_dek,
    dek_iv,
    profile_ciphertext,
    profile_iv,
    remember_token,
    two_factor_secret,
    two_factor_recovery_codes,
    two_factor_confirmed_at,
    created_at,
    updated_at
FROM users;
SQL);

                DB::statement('DROP TABLE users');
                DB::statement('ALTER TABLE users_new RENAME TO users');
            });

            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE users ADD COLUMN username VARCHAR(255) NOT NULL UNIQUE AFTER id');
            DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NULL');
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE users ADD COLUMN username VARCHAR(255) NOT NULL');
            DB::statement('ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username)');
            DB::statement('ALTER TABLE users ALTER COLUMN email DROP NOT NULL');
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->unique()->after('id');
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::transaction(function () {
                DB::statement(<<<'SQL'
CREATE TABLE users_old (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    email_verified_at DATETIME NULL,
    password TEXT NULL,
    providers TEXT NULL,
    kdf_salt TEXT NULL,
    kdf_params TEXT NULL,
    encrypted_dek TEXT NULL,
    dek_iv TEXT NULL,
    profile_ciphertext TEXT NULL,
    profile_iv TEXT NULL,
    remember_token TEXT NULL,
    two_factor_secret TEXT NULL,
    two_factor_recovery_codes TEXT NULL,
    two_factor_confirmed_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL
);
SQL);

                DB::statement(<<<'SQL'
INSERT INTO users_old (
    id,
    email,
    email_verified_at,
    password,
    providers,
    kdf_salt,
    kdf_params,
    encrypted_dek,
    dek_iv,
    profile_ciphertext,
    profile_iv,
    remember_token,
    two_factor_secret,
    two_factor_recovery_codes,
    two_factor_confirmed_at,
    created_at,
    updated_at
)
SELECT
    id,
    COALESCE(email, username || '@local.invalid') AS email,
    email_verified_at,
    password,
    providers,
    kdf_salt,
    kdf_params,
    encrypted_dek,
    dek_iv,
    profile_ciphertext,
    profile_iv,
    remember_token,
    two_factor_secret,
    two_factor_recovery_codes,
    two_factor_confirmed_at,
    created_at,
    updated_at
FROM users;
SQL);

                DB::statement('DROP TABLE users');
                DB::statement('ALTER TABLE users_old RENAME TO users');
            });

            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE users DROP COLUMN username');
            DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NOT NULL');
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique');
            DB::statement('ALTER TABLE users DROP COLUMN username');
            DB::statement('ALTER TABLE users ALTER COLUMN email SET NOT NULL');
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropColumn('username');
            $table->string('email')->nullable(false)->change();
        });
    }
};
