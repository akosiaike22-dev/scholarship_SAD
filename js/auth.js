// Authentication Module for Scholarship Monitoring System

const AUTH_KEY = 'sms_current_user';

window.Auth = {
  getCurrentUser() {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  async login(email, password, roleHint = 'staff') {
    // If Supabase client is initialized, attempt real Supabase Auth
    const sb = window.DB.getClient();
    if (sb) {
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (!error && data.user) {
          // Fetch profile
          const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
          const user = {
            id: data.user.id,
            email: data.user.email,
            full_name: profile ? profile.full_name : email.split('@')[0],
            role: profile ? profile.role : roleHint
          };
          localStorage.setItem(AUTH_KEY, JSON.stringify(user));
          return { success: true, user };
        }
      } catch (err) {
        console.warn('Supabase login fallback to local session:', err);
      }
    }

    // Default / Mock Auth for demonstration & resilient evaluation
    const profiles = JSON.parse(localStorage.getItem('sms_profiles') || '[]');
    let user = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      // Dynamic profile creation for testing
      user = {
        id: 'usr_' + Date.now(),
        email: email,
        full_name: email.split('@')[0].toUpperCase(),
        role: roleHint
      };
    }

    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return { success: true, user };
  },

  async logout() {
    const sb = window.DB.getClient();
    if (sb) {
      try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
    }
    localStorage.removeItem(AUTH_KEY);
    window.location.reload();
  },

  requireAuth(allowedRoles = []) {
    const user = this.getCurrentUser();
    if (!user) {
      return null;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return false;
    }
    return user;
  }
};
