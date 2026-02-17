<?php

use App\Models\Entry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('erstellt und listet verschluesselte Eintraege', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $payload = [
        'day' => '2026-02-17',
        'ciphertext' => base64_encode('ciphertext'),
        'iv' => base64_encode('iv'),
    ];

    $create = $this->postJson('/api/entries', $payload);
    $create->assertCreated();

    $list = $this->getJson('/api/entries?start=2026-02-17&end=2026-02-17');
    $list->assertOk()->assertJsonCount(1, 'entries');
});

it('aktualisiert und loescht Eintraege', function () {
    $user = User::factory()->create();
    $entry = Entry::factory()->create([
        'user_id' => $user->id,
        'day' => '2026-02-16',
        'ciphertext' => base64_encode('old'),
        'iv' => base64_encode('old-iv'),
    ]);

    $this->actingAs($user);

    $update = $this->patchJson("/api/entries/{$entry->id}", [
        'ciphertext' => base64_encode('new'),
        'iv' => base64_encode('new-iv'),
    ]);
    $update->assertOk();

    $this->assertDatabaseHas('entries', [
        'id' => $entry->id,
    ]);

    $delete = $this->deleteJson("/api/entries/{$entry->id}");
    $delete->assertOk();

    $this->assertDatabaseMissing('entries', [
        'id' => $entry->id,
    ]);
});
