<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('registriert einen Nutzer mit Benutzername', function () {
    $response = $this->withoutMiddleware()->postJson('/api/auth/register', [
        'username' => 'testenutzer',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertCreated();
    $this->assertDatabaseHas('users', [
        'username' => 'testenutzer',
    ]);
});

it('meldet Nutzer mit Benutzername an', function () {
    $user = User::factory()->create([
        'username' => 'loginuser',
        'password' => 'password',
    ]);

    $response = $this->withoutMiddleware()->postJson('/api/auth/login', [
        'username' => 'loginuser',
        'password' => 'password',
    ]);

    $response->assertOk();
    $this->assertAuthenticated();
});
