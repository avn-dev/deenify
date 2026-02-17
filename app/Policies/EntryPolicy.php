<?php

namespace App\Policies;

use App\Models\Entry;
use App\Models\User;

class EntryPolicy
{
    public function view(User $user, Entry $entry): bool
    {
        return $entry->user_id === $user->id;
    }

    public function update(User $user, Entry $entry): bool
    {
        return $entry->user_id === $user->id;
    }

    public function delete(User $user, Entry $entry): bool
    {
        return $entry->user_id === $user->id;
    }
}
