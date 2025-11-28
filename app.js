// ========== LocalStorage helpers ==========
const LS_USERS_KEY = "pft_users";
const LS_SESSION_KEY = "pft_current_user";
const LS_EXPENSE_PREFIX = "pft_expenses_";

function getUsers() {
  const data = localStorage.getItem(LS_USERS_KEY);
  return data ? JSON.parse(data) : [];
}
function saveUsers(users) {
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
}
function getCurrentUser() {
  const data = localStorage.getItem(LS_SESSION_KEY);
  return data ? JSON.parse(data) : null;
}
function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(LS_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LS_SESSION_KEY);
  }
}
function getExpensesForUser(email) {
  const data = localStorage.getItem(LS_EXPENSE_PREFIX + email);
  return data ? JSON.parse(data) : [];
}
function saveExpensesForUser(email, expenses) {
  localStorage.setItem(LS_EXPENSE_PREFIX + email, JSON.stringify(expenses));
}

// ========== UI Elements ==========
const authSection = document.getElementById("auth-section");
const signinView = document.getElementById("signin-view");
const signupView = document.getElementById("signup-view");
const dashboardSection = document.getElementById("dashboard-section");

const signinForm = document.getElementById("signin-form");
const signupForm = document.getElementById("signup-form");
const goToSignupBtn = document.getElementById("go-to-signup");
const goToSigninBtn = document.getElementById("go-to-signin");
const signinErrorEl = document.getElementById("signin-error");
const signupErrorEl = document.getElementById("signup-error");
const signupSuccessEl = document.getElementById("signup-success");

const welcomeText = document.getElementById("welcome-text");
const logoutBtn = document.getElementById("logout-btn");
const expenseForm = document.getElementById("expense-form");
const expenseListEl = document.getElementById("expense-list");
const totalExpensesEl = document.getElementById("total-expenses");
const totalTransactionsEl = document.getElementById("total-transactions");
const averageExpenseEl = document.getElementById("average-expense");
const noDataTextEl = document.getElementById("no-data-text");
const categoryListEl = document.getElementById("category-list");
const expenseChartCanvas = document.getElementById("expense-chart");
const ctx = expenseChartCanvas.getContext("2d");

// state
let currentUser = null;
let expenses = [];
let chart = null;

// ========== View switching ==========
function showSignin() {
  authSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
  signinView.classList.remove("hidden");
  signupView.classList.add("hidden");
}
function showSignup() {
  authSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
  signinView.classList.add("hidden");
  signupView.classList.remove("hidden");
}
function showDashboard() {
  authSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
}

// ========== Auth ==========
signinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("signin-email").value.trim();
  const password = document.getElementById("signin-password").value.trim();
  const users = getUsers();
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) {
    signinErrorEl.textContent = "Invalid email or password.";
    return;
  }
  setCurrentUser(user);
  currentUser = user;
  loadDashboard();
});

signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();
  const confirmPassword = document
    .getElementById("signup-confirm-password")
    .value.trim();

  if (password !== confirmPassword) {
    signupErrorEl.textContent = "Passwords do not match.";
    return;
  }

  const users = getUsers();
  if (users.find((u) => u.email === email)) {
    signupErrorEl.textContent = "Email already registered.";
    return;
  }

  const newUser = { name, email, password };
  users.push(newUser);
  saveUsers(users);
  signupErrorEl.textContent = "";
  signupSuccessEl.textContent =
    "Account created successfully! You can sign in now.";
});

goToSignupBtn.addEventListener("click", showSignup);
goToSigninBtn.addEventListener("click", showSignin);

logoutBtn.addEventListener("click", () => {
  setCurrentUser(null);
  currentUser = null;
  showSignin();
});

// ========== Expenses ==========
expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("expense-title").value.trim();
  const amount = parseFloat(document.getElementById("expense-amount").value);
  const category = document.getElementById("expense-category").value;
  const date = document.getElementById("expense-date").value;

  const newExpense = { title, amount, category, date };
  expenses.push(newExpense);
  saveExpensesForUser(currentUser.email, expenses);
  renderExpenses();
  expenseForm.reset();
});

// ========== Rendering ==========
function renderExpenses() {
  expenseListEl.innerHTML = "";
  if (expenses.length === 0) {
    noDataTextEl.classList.remove("hidden");
  } else {
    noDataTextEl.classList.add("hidden");
  }

  expenses
    .slice()
    .reverse()
    .forEach((exp) => {
      const li = document.createElement("li");
      li.textContent = `${exp.date} - ${exp.title} ($${exp.amount.toFixed(
        2
      )}) [${exp.category}]`;
      expenseListEl.appendChild(li);
    });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const avg = expenses.length ? total / expenses.length : 0;

  totalExpensesEl.textContent = `$${total.toFixed(2)}`;
  totalTransactionsEl.textContent = expenses.length;
  averageExpenseEl.textContent = `$${avg.toFixed(2)}`;

  renderChart();
  renderCategories();
}

function renderCategories() {
  categoryListEl.innerHTML = "";
  const categoryTotals = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    const li = document.createElement("li");
    li.textContent = `${cat}: $${amt.toFixed(2)}`;
    categoryListEl.appendChild(li);
  });
}

function renderChart() {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js not loaded — skipping chart rendering.");
    return;
  }
  if (chart) chart.destroy();
  const categoryTotals = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "#6366f1",
            "#22c55e",
            "#ef4444",
            "#f59e0b",
            "#3b82f6",
            "#14b8a6",
            "#a855f7",
            "#64748b",
          ],
        },
      ],
    },
  });
}

// ========== Dashboard ==========
function loadDashboard() {
  currentUser = getCurrentUser();
  if (!currentUser) {
    showSignin();
    return;
  }
  welcomeText.textContent = `Welcome, ${currentUser.name}!`;
  expenses = getExpensesForUser(currentUser.email);
  showDashboard();
  renderExpenses();
}

// ========== Mock Data ==========
function seedMockData() {
  if (getUsers().length === 0) {
    const mockUser = {
      name: "Demo User",
      email: "demo@test.com",
      password: "123456",
    };
    saveUsers([mockUser]);
    const mockExpenses = [
      {
        title: "Groceries",
        amount: 45.5,
        category: "Food",
        date: "2025-11-20",
      },
      {
        title: "Bus Ticket",
        amount: 2.5,
        category: "Transport",
        date: "2025-11-21",
      },
      {
        title: "Movie Night",
        amount: 12,
        category: "Entertainment",
        date: "2025-11-22",
      },
      {
        title: "Electric Bill",
        amount: 30,
        category: "Utilities",
        date: "2025-11-23",
      },
    ];
    saveExpensesForUser(mockUser.email, mockExpenses);
  }
}

// ========== Init ==========
seedMockData();
loadDashboard();
