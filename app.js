const STORAGE_KEY = "habit-bloom-data";

const defaultState = {
  currentUserEmail: null,
  accounts: {}
};

let state = loadState();

const authForm = document.getElementById("authForm");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const logoutButton = document.getElementById("logoutButton");
const authStatus = document.getElementById("authStatus");

const habitForm = document.getElementById("habitForm");
const habitIdInput = document.getElementById("habitId");
const habitNameInput = document.getElementById("habitName");
const habitFrequencyInput = document.getElementById("habitFrequency");
const habitTargetInput = document.getElementById("habitTarget");
const habitReminderInput = document.getElementById("habitReminder");
const cancelEditButton = document.getElementById("cancelEditButton");
const saveHabitButton = document.getElementById("saveHabitButton");
const habitFilter = document.getElementById("habitFilter");

const habitList = document.getElementById("habitList");
const reminderList = document.getElementById("reminderList");
const historyList = document.getElementById("historyList");
const habitCardTemplate = document.getElementById("habitCardTemplate");

authForm.addEventListener("submit", handleAuthSubmit);
logoutButton.addEventListener("click", handleLogout);
habitForm.addEventListener("submit", handleHabitSubmit);
cancelEditButton.addEventListener("click", resetHabitForm);
habitFilter.addEventListener("change", render);

render();

function createDefaultState() {
  return {
    currentUserEmail: null,
    accounts: {}
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      currentUserEmail: parsed.currentUserEmail ?? null,
      accounts: parsed.accounts && typeof parsed.accounts === "object" ? parsed.accounts : {}
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function handleAuthSubmit(event) {
  event.preventDefault();

  const email = authEmail.value.trim().toLowerCase();
  const user = {
    name: authName.value.trim(),
    email
  };

  const existingAccount = state.accounts[email];

  state.accounts[email] = {
    user,
    habits: Array.isArray(existingAccount?.habits) ? existingAccount.habits : [],
    history: Array.isArray(existingAccount?.history) ? existingAccount.history : []
  };
  state.currentUserEmail = email;

  saveState();
  render();
  authForm.reset();
}

function handleLogout() {
  state.currentUserEmail = null;
  saveState();
  render();
}

function handleHabitSubmit(event) {
  event.preventDefault();

  const account = getCurrentAccount();

  if (!account) {
    window.alert("Please login or create an account before adding habits.");
    return;
  }

  const habit = {
    id: habitIdInput.value || crypto.randomUUID(),
    name: habitNameInput.value.trim(),
    frequency: habitFrequencyInput.value,
    target: habitTargetInput.value.trim(),
    reminder: habitReminderInput.value,
    createdAt: findExistingHabit(habitIdInput.value)?.createdAt || new Date().toISOString(),
    completions: findExistingHabit(habitIdInput.value)?.completions || []
  };

  const existingIndex = account.habits.findIndex((item) => item.id === habit.id);

  if (existingIndex >= 0) {
    account.habits[existingIndex] = habit;
  } else {
    account.habits.unshift(habit);
  }

  saveState();
  resetHabitForm();
  render();
}

function findExistingHabit(habitId) {
  return getCurrentAccount()?.habits.find((habit) => habit.id === habitId);
}

function resetHabitForm() {
  habitForm.reset();
  habitIdInput.value = "";
  habitFrequencyInput.value = "daily";
  saveHabitButton.textContent = "Save habit";
}

function toggleHabitCompletion(habitId) {
  const todayKey = getTodayKey();
  const account = getCurrentAccount();
  const habit = account?.habits.find((item) => item.id === habitId);

  if (!habit) {
    return;
  }

  const completionIndex = habit.completions.indexOf(todayKey);

  if (completionIndex >= 0) {
    habit.completions.splice(completionIndex, 1);
    account.history = account.history.filter(
      (entry) => !(entry.habitId === habit.id && entry.date === todayKey)
    );
  } else {
    habit.completions.unshift(todayKey);
    account.history.unshift({
      id: crypto.randomUUID(),
      habitId: habit.id,
      habitName: habit.name,
      date: todayKey,
      completedAt: new Date().toISOString()
    });
  }

  saveState();
  render();
}

function editHabit(habitId) {
  const habit = getCurrentAccount()?.habits.find((item) => item.id === habitId);

  if (!habit) {
    return;
  }

  habitIdInput.value = habit.id;
  habitNameInput.value = habit.name;
  habitFrequencyInput.value = habit.frequency;
  habitTargetInput.value = habit.target;
  habitReminderInput.value = habit.reminder;
  saveHabitButton.textContent = "Update habit";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteHabit(habitId) {
  const account = getCurrentAccount();
  const habit = account?.habits.find((item) => item.id === habitId);

  if (!habit) {
    return;
  }

  const confirmed = window.confirm(`Delete "${habit.name}"?`);

  if (!confirmed) {
    return;
  }

  account.habits = account.habits.filter((item) => item.id !== habitId);
  account.history = account.history.filter((entry) => entry.habitId !== habitId);
  saveState();
  render();
}

function render() {
  renderAuth();
  renderStats();
  renderHabits();
  renderReminders();
  renderHistory();
}

function renderAuth() {
  const account = getCurrentAccount();

  if (account) {
    authStatus.textContent = `${account.user.name} logged in`;
    authName.value = account.user.name;
    authEmail.value = account.user.email;
  } else {
    authStatus.textContent = "Logged out";
    authForm.reset();
  }
}

function renderStats() {
  const account = getCurrentAccount();
  const habits = account?.habits ?? [];
  const history = account?.history ?? [];
  const todayHabits = habits.filter(isHabitScheduledForToday);
  const completedCount = todayHabits.filter((habit) => isHabitCompleteToday(habit)).length;
  const pendingCount = Math.max(todayHabits.length - completedCount, 0);
  const completionRate = todayHabits.length === 0
    ? 0
    : Math.round((completedCount / todayHabits.length) * 100);

  const weekCount = countCompletionsInLastDays(history, 7);
  const expectedWeekCompletions = habits.filter((habit) => habit.frequency === "daily").length * 7
    + habits.filter((habit) => habit.frequency === "weekly").length;
  const weeklyRate = expectedWeekCompletions === 0
    ? 0
    : Math.min(100, Math.round((weekCount / expectedWeekCompletions) * 100));

  setText("totalHabits", habits.length);
  setText("completedToday", completedCount);
  setText("pendingToday", pendingCount);
  setText("weeklyProgress", `${weeklyRate}%`);
  setText("completionPercentage", `${completionRate}%`);
  setText("heroCompletionRate", `${completionRate}%`);
  setText("heroTotalHabits", habits.length);
  setText("heroPendingHabits", pendingCount);
  document.getElementById("progressFill").style.width = `${completionRate}%`;
}

function renderHabits() {
  const filteredHabits = getFilteredHabits();

  if (filteredHabits.length === 0) {
    renderEmptyState(habitList, "No habits match this view yet. Add one to get started.");
    return;
  }

  habitList.classList.remove("empty-state");
  habitList.innerHTML = "";

  filteredHabits.forEach((habit) => {
    const fragment = habitCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".habit-card");
    const title = fragment.querySelector(".habit-title");
    const meta = fragment.querySelector(".habit-meta");
    const status = fragment.querySelector(".habit-status");
    const completeButton = fragment.querySelector(".complete-button");
    const editButton = fragment.querySelector(".edit-button");
    const deleteButton = fragment.querySelector(".delete-button");

    const completed = isHabitCompleteToday(habit);
    const scheduledToday = isHabitScheduledForToday(habit);

    title.textContent = habit.name;
    meta.textContent = `${capitalize(habit.frequency)} target: ${habit.target}${habit.reminder ? ` • Reminder ${habit.reminder}` : ""}`;
    status.textContent = completed ? "Completed" : scheduledToday ? "Pending" : "Upcoming";
    status.classList.toggle("pending", !completed);
    completeButton.textContent = completed ? "Undo today" : "Mark complete";
    completeButton.disabled = !scheduledToday;
    completeButton.addEventListener("click", () => toggleHabitCompletion(habit.id));
    editButton.addEventListener("click", () => editHabit(habit.id));
    deleteButton.addEventListener("click", () => deleteHabit(habit.id));

    card.dataset.frequency = habit.frequency;
    habitList.appendChild(fragment);
  });
}

function renderReminders() {
  const habitsWithReminders = (getCurrentAccount()?.habits ?? [])
    .filter((habit) => habit.reminder)
    .sort((a, b) => a.reminder.localeCompare(b.reminder));

  if (habitsWithReminders.length === 0) {
    renderEmptyState(reminderList, "Set a reminder time on a habit and it will appear here.");
    return;
  }

  reminderList.classList.remove("empty-state");
  reminderList.innerHTML = "";

  habitsWithReminders.forEach((habit) => {
    const card = document.createElement("article");
    card.className = "list-card reminder-row";
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(habit.name)}</strong>
        <span>${capitalize(habit.frequency)} habit • target ${escapeHtml(habit.target)}</span>
      </div>
      <strong>${habit.reminder}</strong>
    `;
    reminderList.appendChild(card);
  });
}

function renderHistory() {
  const recentHistory = [...(getCurrentAccount()?.history ?? [])]
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 8);

  if (recentHistory.length === 0) {
    renderEmptyState(historyList, "Complete a habit and your recent history will show up here.");
    return;
  }

  historyList.classList.remove("empty-state");
  historyList.innerHTML = "";

  recentHistory.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "list-card history-row";
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(entry.habitName)}</strong>
        <span>Completed on ${formatDate(entry.date)}</span>
      </div>
      <strong>${formatTime(entry.completedAt)}</strong>
    `;
    historyList.appendChild(card);
  });
}

function renderEmptyState(target, message) {
  target.className = `${target.className.split(" ")[0]} empty-state`;
  target.innerHTML = `<div class="empty-message">${message}</div>`;
}

function getFilteredHabits() {
  const filterValue = habitFilter.value;
  const habits = getCurrentAccount()?.habits ?? [];

  return habits.filter((habit) => {
    if (filterValue === "all") {
      return true;
    }

    if (filterValue === "daily" || filterValue === "weekly") {
      return habit.frequency === filterValue;
    }

    if (filterValue === "completed") {
      return isHabitCompleteToday(habit);
    }

    if (filterValue === "pending") {
      return isHabitScheduledForToday(habit) && !isHabitCompleteToday(habit);
    }

    return true;
  });
}

function isHabitScheduledForToday(habit) {
  if (habit.frequency === "daily") {
    return true;
  }

  const createdDate = new Date(habit.createdAt);
  const today = new Date();
  return createdDate.getDay() === today.getDay();
}

function isHabitCompleteToday(habit) {
  return habit.completions.includes(getTodayKey());
}

function countCompletionsInLastDays(historyEntries, days) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - (days - 1));
  threshold.setHours(0, 0, 0, 0);

  return historyEntries.filter((entry) => new Date(entry.completedAt) >= threshold).length;
}

function getCurrentAccount() {
  if (!state.currentUserEmail) {
    return null;
  }

  return state.accounts[state.currentUserEmail] ?? null;
}

function getTodayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
