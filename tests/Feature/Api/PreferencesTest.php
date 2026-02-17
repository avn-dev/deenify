<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('speichert und liest verschluesselte preferences', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $payload = [
        'ciphertext' => base64_encode('prefs'),
        'iv' => base64_encode('iv'),
    ];

    $save = $this->putJson('/api/preferences', $payload);
    $save->assertOk();

    $get = $this->getJson('/api/preferences');
    $get->assertOk()->assertJson([
        'preference' => $payload,
    ]);
});
