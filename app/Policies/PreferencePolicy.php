<?php

namespace App\Policies;

use App\Models\Preference;
use App\Models\User;

class PreferencePolicy
{
    public function view(User $user, Preference $preference): bool
    {
        return $preference->user_id === $user->id;
    }

    public function update(User $user, Preference $preference): bool
    {
        return $preference->user_id === $user->id;
    }
}
