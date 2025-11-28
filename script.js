/* script.js
   Finance tracker logic:
   - Loads current user
   - Manages expenses stored per user: key "expenses_<sanitizedEmail>"
   - Renders list, summary and pie chart
*/

(function () {
  // Utility helpers
  function sanitizeKey(email) {
    if (!email) return '';
    return email.replace(/[@.]/g, '_');
  }

  function expensesKeyFor(email) {
    return 'expenses_' + sanitizeKey(email);
  }

  function loadExpenses(email) {
    const key = expensesKeyFor(email);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw) || [];
    } catch (e) {
      console.error('Failed to parse expenses', e);
      return [];
    }
  }

  function saveExpenses(email, expenses) {
    const key = expensesKeyFor(email);
    localStorage.setItem(key, JSON.stringify(expenses || []));
  }

  // DOM
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // Ensure user is logged in
    const user = auth_getLoggedInUser();
    if (!user) {
      // Not logged in -> redirect
      window.location.href = 'signin.html';
      return;
    }

    // Setup welcome and logout
    const welcomeText = document.getElementById('welcomeText');
    welcomeText.textContent = `Hi, ${user.fullName}`;

    document.getElementById('logoutBtn').addEventListener('click', function () {
      auth_signOut();
      window.location.href = 'signin.html';
    });

    // Prepare default date value
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().slice(0, 10);
    if (dateInput) dateInput.value = today;

    // Load and render expenses
    const expenses = loadExpenses(user.email);
    state.expenses = expenses;

    renderAll();

    // Form handlers
    const form = document.getElementById('expenseForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      addExpenseFromForm(user.email);
    });

    document.getElementById('clearBtn').addEventListener('click', function () {
      form.reset();
      if (dateInput) dateInput.value = today;
    });
  }

  const state = {
    expenses: []
  };

  function addExpenseFromForm(email) {
    const title = document.getElementById('title').value.trim();
    const amountRaw = document.getElementById('amount').value;
    const amount = parseFloat(amountRaw);
    const category = document.getElementById('category').value || 'Other';
    const date = document.getElementById('date').value;

    if (!title || !amount || !date) {
      alert('Please fill out title, amount and date.');
      return;
    }
    if (amount <= 0 || isNaN(amount)) {
      alert('Please enter a valid amount greater than zero.');
      return;
    }

    const expense = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2,8),
      title,
      amount: parseFloat(amount.toFixed(2)),
      category,
      date // ISO yyyy-mm-dd
    };

    state.expenses.unshift(expense); // newest first
    saveExpenses(email, state.expenses);
    renderAll();

    // Reset form
    document.getElementById('expenseForm').reset();
    document.getElementById('date').value = new Date().toISOString().slice(0, 10);
  }

  function deleteExpense(email, id) {
    if (!confirm('Delete this expense?')) return;
    const idx = state.expenses.findIndex(e => e.id === id);
    if (idx >= 0) {
      state.expenses.splice(idx, 1);
      saveExpenses(email, state.expenses);
      renderAll();
    }
  }

  // Render everything: list, summary, chart
  function renderAll() {
    const user = auth_getLoggedInUser();
    if (!user) return;
    renderExpensesList(user.email);
    renderSummary(user.email);
    drawPieChart(user.email);
  }

  function renderExpensesList(email) {
    const container = document.getElementById('expensesContainer');
    container.innerHTML = '';

    if (!state.expenses || state.expenses.length === 0) {
      container.innerHTML = '<p class="muted">No expenses recorded yet. Add one using the form above.</p>';
      return;
    }

    // For larger screens show table otherwise cards (CSS handles hiding header)
    const table = document.createElement('table');
    table.className = 'table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Title</th><th>Category</th><th>Date</th><th>Amount</th><th></th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    state.expenses.forEach(exp => {
      const tr = document.createElement('tr');
      const tdTitle = document.createElement('td'); tdTitle.textContent = exp.title;
      const tdCategory = document.createElement('td'); tdCategory.innerHTML = `<span class="tag">${escapeHtml(exp.category)}</span>`;
      const tdDate = document.createElement('td'); tdDate.textContent = exp.date;
      const tdAmount = document.createElement('td'); tdAmount.textContent = `$${parseFloat(exp.amount).toFixed(2)}`;
      const tdAction = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-outline';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', function () { deleteExpense(email, exp.id); });
      tdAction.appendChild(delBtn);

      tr.appendChild(tdTitle);
      tr.appendChild(tdCategory);
      tr.appendChild(tdDate);
      tr.appendChild(tdAmount);
      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    // Additionally append card list for mobile view
    const cardList = document.createElement('div');
    cardList.className = 'card-list';
    state.expenses.forEach(exp => {
      const card = document.createElement('div');
      card.className = 'card';
      const left = document.createElement('div'); left.className = 'left';
      const title = document.createElement('div'); title.textContent = exp.title;
      title.style.fontWeight = '700';
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.innerHTML = `${escapeHtml(exp.category)} • ${exp.date}`;
      left.appendChild(title);
      left.appendChild(meta);

      const right = document.createElement('div'); right.style.textAlign = 'right';
      const amount = document.createElement('div'); amount.textContent = `$${parseFloat(exp.amount).toFixed(2)}`;
      amount.style.fontWeight = '700';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-outline';
      delBtn.textContent = 'Delete';
      delBtn.style.marginTop = '8px';
      delBtn.addEventListener('click', function () { deleteExpense(email, exp.id); });

      right.appendChild(amount);
      right.appendChild(delBtn);

      card.appendChild(left);
      card.appendChild(right);
      cardList.appendChild(card);
    });
    container.appendChild(cardList);
  }

  function renderSummary(email) {
    // Compute summary for current month
    const totalEl = document.getElementById('totalSpent');
    const highestEl = document.getElementById('highestCategory');
    const lowestEl = document.getElementById('lowestCategory');

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter expenses in current month
    const expensesThisMonth = state.expenses.filter(exp => {
      try {
        const d = new Date(exp.date + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      } catch (e) {
        return false;
      }
    });

    const total = expensesThisMonth.reduce((s, e) => s + Number(e.amount || 0), 0);
    totalEl.textContent = `$${total.toFixed(2)}$`;

    // Sum by category
    const byCat = {};
    expensesThisMonth.forEach(e => {
      byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0);
    });
    const entries = Object.entries(byCat);
    if (entries.length === 0) {
      highestEl.textContent = '—';
      lowestEl.textContent = '—';
      return;
    }
    entries.sort((a,b) => b[1] - a[1]); // desc
    highestEl.textContent = `${entries[0][0]} ($${entries[0][1].toFixed(2)})`;
    const last = entries[entries.length - 1];
    lowestEl.textContent = `${last[0]} ($${last[1].toFixed(2)})`;
  }

  // Pie chart: categories for current month
  function drawPieChart(email) {
    const canvas = document.getElementById('pieChart');
    const legend = document.getElementById('chartLegend');
    if (!canvas || !legend) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    legend.innerHTML = '';

    const now = new Date();
    const cm = now.getMonth();
    const cy = now.getFullYear();

    // Build category totals for current month
    const totals = {};
    state.expenses.forEach(e => {
      const d = new Date(e.date + 'T00:00:00');
      if (d.getMonth() === cm && d.getFullYear() === cy) {
        totals[e.category] = (totals[e.category] || 0) + Number(e.amount) || 0;
      }
    });
    const entries = Object.entries(totals);
    if (entries.length === 0) {
      // draw empty circle or message
      ctx.fillStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.arc(canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height)/6, 0, Math.PI * 2);
      ctx.fill();
      legend.innerHTML = '<span class="muted">No data for this month</span>';
      return;
    }

    const total = entries.reduce((s,e) => s + e[1], 0);
    // Colors palette
    const palette = [
      '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6'
    ];

    // Sort entries desc for nicer visual
    entries.sort((a,b) => b[1] - a[1]);

    let startAngle = -Math.PI / 2;
    entries.forEach((entry, idx) => {
      const [cat, val] = entry;
      const slice = val / total;
      const angle = slice * Math.PI * 2;
      const color = palette[idx % palette.length];
      // draw slice
      ctx.beginPath();
      ctx.moveTo(canvas.width/2, canvas.height/2);
      ctx.arc(canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height)/2.4, startAngle, startAngle + angle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Add legend
      const percent = (slice * 100);
      const legendItem = document.createElement('div');
      legendItem.style.display = 'flex';
      legendItem.style.alignItems = 'center';
      legendItem.style.gap = '8px';
      legendItem.style.marginBottom = '6px';
      legendItem.innerHTML = `<span style="width:14px;height:14px;border-radius:4px;background:${color};display:inline-block"></span>
        <span style="font-weight:600">${escapeHtml(cat)}</span>
        <span class="muted" style="margin-left:6px"> — ${percent.toFixed(1)}% ($${val.toFixed(2)})</span>`;
      legend.appendChild(legendItem);

      startAngle += angle;
    });
  }

  // Simple escape for text nodes
  function escapeHtml(text){
    if (typeof text !== 'string') return text;
    return text.replace(/[&<>\"']/g, (c) => {
      switch (c) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case '\' : return '&#92;';
        case "'": return '&#39;';
      }
    });
  }
})();