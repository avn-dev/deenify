<?php

namespace Database\Factories;

use App\Models\Entry;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Entry>
 */
class EntryFactory extends Factory
{
    protected $model = Entry::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'day' => $this->faker->date(),
            'ciphertext' => base64_encode('ciphertext'),
            'iv' => base64_encode('iv'),
            'aad' => null,
        ];
    }
}
