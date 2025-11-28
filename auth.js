/* auth.js
   Provides authentication utilities operating on localStorage.
   Exposed functions (global):
     auth_getUsers()
     auth_saveUsers(users)
     auth_signUp({fullName,email,password,confirmPassword})
     auth_signIn(email,password)
     auth_signOut()
     auth_getLoggedInUser()
     auth_requireAuth(redirectTo)  // optional
*/

(function () {
  // Keys used in localStorage
  const USERS_KEY = 'pft_users';
  const LOGGED_IN_KEY = 'pft_loggedInUser';

  // Utility: fetch users array
  function getUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) return [];
      return JSON.parse(raw) || [];
    } catch (e) {
      console.error('Failed to parse users from localStorage', e);
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users || []));
  }

  function getLoggedInUser() {
    try {
      const raw = localStorage.getItem(LOGGED_IN_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setLoggedInUser(user) {
    if (!user) {
      localStorage.removeItem(LOGGED_IN_KEY);
      return;
    }
    localStorage.setItem(LOGGED_IN_KEY, JSON.stringify(user));
  }

  function signUp({ fullName, email, password, confirmPassword }) {
    if (!fullName || !email || !password || !confirmPassword) {
      return { success: false, message: 'Please fill all fields' };
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (password !== confirmPassword) {
      return { success: false, message: 'Passwords do not match' };
    }
    const users = getUsers();
    if (users.some(u => u.email === normalizedEmail)) {
      return { success: false, message: 'An account with this email already exists' };
    }
    // Create user (store password plain for this mock system)
    const user = {
      id: Date.now(),
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: password,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
    return { success: true, user };
  }

  function signIn(email, password) {
    if (!email || !password) {
      return { success: false, message: 'Please enter email and password' };
    }
    const normalizedEmail = email.trim().toLowerCase();
    const users = getUsers();
    const user = users.find(u => u.email === normalizedEmail);
    if (!user) {
      return { success: false, message: 'No account found with this email' };
    }
    if (user.password !== password) {
      return { success: false, message: 'Incorrect password' };
    }
    // Set session
    setLoggedInUser({ id: user.id, email: user.email, fullName: user.fullName });
    return { success: true, user: { id: user.id, email: user.email, fullName: user.fullName } };
  }

  function signOut() {
    setLoggedInUser(null);
  }

  function requireAuth(redirectTo = 'signin.html') {
    const user = getLoggedInUser();
    if (!user) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }

  // Seed demo user and sample expenses if none exist
  function seedDemoIfNeeded() {
    const users = getUsers();
    if (users.length === 0) {
      const demoEmail = 'demo@example.com';
      const demo = {
        id: 100001,
        fullName: 'Demo User',
        email: demoEmail,
        password: 'demo123',
        createdAt: new Date().toISOString()
      };
      users.push(demo);
      saveUsers(users);

      // Seed sample expenses for demo user
      const demoExpenses = [
        { id: 'e1', title: 'Groceries', amount: 72.45, category: 'Food', date: new Date().toISOString().slice(0,10) },
        { id: 'e2', title: 'Bus Pass', amount: 25.00, category: 'Transport', date: new Date().toISOString().slice(0,10) },
        { id: 'e3', title: 'Movie Night', amount: 15.50, category: 'Entertainment', date: new Date().toISOString().slice(0,10) }
      ];
      const expensesKey = 'expenses_' + demoEmail.replace(/[@.]/g, '_');
      localStorage.setItem(expensesKey, JSON.stringify(demoExpenses));
    }
  }

  // Expose functions globally with auth_ prefix
  window.auth_getUsers = getUsers;
  window.auth_saveUsers = saveUsers;
  window.auth_signUp = signUp;
  window.auth_signIn = signIn;
  window.auth_signOut = signOut;
  window.auth_getLoggedInUser = getLoggedInUser;
  window.auth_requireAuth = requireAuth;

  // Run seeding on load
  try { seedDemoIfNeeded(); } catch (e) { console.error('Seeding demo failed', e); }
})();
