// Authentication and Session Handling for ScholarTrack

(() => {
  const SESSION_KEY = 'sms_active_session';

  function getCurrentUser() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* ignore */ }
    }
    // Default logged in staff for immediate usability and laboratory demonstration
    return {
      id: 'demo-staff-id',
      email: 'staff@scholarship.edu',
      full_name: 'Scholarship Staff',
      role: 'staff'
    };
  }

  function setCurrentUser(user) {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  async function login(email, password) {
    // If real Supabase client is active, attempt auth
    if (window.db && window.SUPABASE_URL && !window.SUPABASE_URL.includes('YOUR_PROJECT_ID') && window.supabase) {
      try {
        const { data, error } = await window.db.auth.signInWithPassword({ email, password });
        if (error) return { error };
        const user = {
          id: data.user.id,
          email: data.user.email,
          role: data.user.email.includes('admin') ? 'admin' : data.user.email.includes('scholar') ? 'scholar' : 'staff',
          full_name: data.user.email.split('@')[0]
        };
        setCurrentUser(user);
        return { data: user, error: null };
      } catch (err) {
        console.warn('Supabase auth failed, using demo auth:', err);
      }
    }

    // Local / Demo Login
    const role = email.includes('admin') ? 'admin' : email.includes('scholar') ? 'scholar' : 'staff';
    const user = {
      id: 'usr_' + Date.now(),
      email,
      role,
      full_name: email.split('@')[0]
    };
    setCurrentUser(user);
    return { data: user, error: null };
  }

  async function logout() {
    if (window.db?.auth?.signOut) {
      try { await window.db.auth.signOut(); } catch (e) { /* ignore */ }
    }
    setCurrentUser(null);
    window.location.href = 'login.html';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const user = getCurrentUser();

    // User label in topbar
    const userLabel = document.querySelector('#user-label');
    if (userLabel && user) {
      userLabel.textContent = `${user.role.toUpperCase()} · ${user.email}`;
    }

    // Logout buttons
    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    });

    // Login Form
    const loginForm = document.querySelector('#login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.elements.email.value.trim();
        const password = loginForm.elements.password.value;
        const msg = document.querySelector('#login-message');

        const { data, error } = await login(email, password);
        if (error) {
          if (msg) msg.textContent = error.message;
        } else {
          window.location.href = 'index.html';
        }
      });
    }

    // Sign Up Form
    const signupForm = document.querySelector('#signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = signupForm.elements.full_name.value.trim();
        const email = signupForm.elements.email.value.trim();
        const password = signupForm.elements.password.value;
        const msg = document.querySelector('#login-message');

        const { data, error } = await login(email, password);
        if (data) {
          data.full_name = fullName;
          setCurrentUser(data);
          window.location.href = 'index.html';
        }
      });
    }
  });

  window.Auth = {
    getCurrentUser,
    setCurrentUser,
    login,
    logout
  };
})();
