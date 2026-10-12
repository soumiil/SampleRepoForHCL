const STORAGE_KEY = "daymark-tasks-v1";
const taskList = document.querySelector("#task-list");
const taskDialog = document.querySelector("#task-dialog");
const taskForm = document.querySelector("#task-form");
const statusFilter = document.querySelector("#status-filter");
const priorityFilter = document.querySelector("#priority-filter");
const searchInput = document.querySelector("#search-input");
const today = localDateString(new Date());

let selectedView = "all";
let toastTimer;
let tasks = loadTasks();

function localDateString(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function dateOffset(days) {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return localDateString(date);
}

function makeId() {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadTasks() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (Array.isArray(saved)) return saved;
	} catch (error) {
		console.warn("Could not read saved tasks.", error);
	}

	return [
		{ id: makeId(), title: "Finish biology lab report", description: "Add the results table and check the conclusion.", dueDate: dateOffset(0), priority: "high", completed: false },
		{ id: makeId(), title: "Read chapter 6 for history", description: "Focus on the causes of the industrial revolution.", dueDate: dateOffset(1), priority: "medium", completed: false },
		{ id: makeId(), title: "Submit calculus problem set", description: "", dueDate: dateOffset(2), priority: "low", completed: false }
	];
}

function saveTasks() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
	} catch (error) {
		showToast("Couldn't save tasks in this browser.");
		console.error("Could not save tasks.", error);
	}
}

function formatDate(value) {
	if (!value) return "No due date";
	const date = new Date(`${value}T12:00:00`);
	return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function updateDateLabel() {
	document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
		weekday: "long", month: "long", day: "numeric", year: "numeric"
	}).format(new Date());
}

function updateOverview() {
	const openTasks = tasks.filter((task) => !task.completed);
	const dueToday = tasks.filter((task) => task.dueDate === today && !task.completed);
	const todayTasks = tasks.filter((task) => task.dueDate === today);
	const doneToday = todayTasks.filter((task) => task.completed).length;
	const percentage = todayTasks.length ? Math.round((doneToday / todayTasks.length) * 100) : 0;

	document.querySelector("#due-today-count").textContent = dueToday.length;
	document.querySelector("#open-count").textContent = openTasks.length;
	document.querySelector("#progress-copy").textContent = `${doneToday} of ${todayTasks.length} done`;
	document.querySelector("#progress-percent").textContent = `${percentage}%`;
	document.querySelector("#progress-ring").style.setProperty("--progress", `${percentage}%`);
	document.querySelector("#progress-ring").setAttribute("aria-label", `${percentage}% complete`);
	document.querySelector('[data-nav-count="all"]').textContent = tasks.length;
	document.querySelector('[data-nav-count="today"]').textContent = dueToday.length;
	document.querySelector('[data-nav-count="upcoming"]').textContent = openTasks.filter((task) => task.dueDate > today).length;
	document.querySelector('[data-nav-count="completed"]').textContent = tasks.filter((task) => task.completed).length;
}

function getVisibleTasks() {
	const query = searchInput.value.trim().toLocaleLowerCase();
	return tasks.filter((task) => {
		if (selectedView === "today" && task.dueDate !== today) return false;
		if (selectedView === "upcoming" && (task.dueDate <= today || task.completed)) return false;
		if (selectedView === "completed" && !task.completed) return false;
		if (statusFilter.value === "active" && task.completed) return false;
		if (statusFilter.value === "completed" && !task.completed) return false;
		if (priorityFilter.value !== "all" && task.priority !== priorityFilter.value) return false;
		if (query && !`${task.title} ${task.description}`.toLocaleLowerCase().includes(query)) return false;
		return true;
	}).sort((first, second) => {
		if (first.completed !== second.completed) return Number(first.completed) - Number(second.completed);
		return first.dueDate.localeCompare(second.dueDate) || priorityRank(first.priority) - priorityRank(second.priority);
	});
}

function priorityRank(priority) {
	return { high: 0, medium: 1, low: 2 }[priority] ?? 3;
}

function dueLabel(task) {
	if (task.completed) return `Completed · ${formatDate(task.dueDate)}`;
	if (task.dueDate < today) return `<span class="due-today">Overdue · ${formatDate(task.dueDate)}</span>`;
	if (task.dueDate === today) return '<span class="due-today">Due today</span>';
	if (task.dueDate === dateOffset(1)) return '<span class="due-soon">Due tomorrow</span>';
	return `Due ${formatDate(task.dueDate)}`;
}

function renderTasks() {
	const visibleTasks = getVisibleTasks();
	const viewNames = { all: "All tasks", today: "Due today", upcoming: "Upcoming", completed: "Completed" };
	const subtitles = { all: "Everything on your study list", today: "The work on your plate today", upcoming: "A look at what's coming up", completed: "A record of what you've finished" };
	document.querySelector("#tasks-heading").textContent = viewNames[selectedView];
	document.querySelector("#view-subtitle").textContent = subtitles[selectedView];
	document.querySelector("#visible-count").textContent = `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;

	if (!visibleTasks.length) {
		const hasFilters = searchInput.value.trim() || statusFilter.value !== "all" || priorityFilter.value !== "all";
		taskList.innerHTML = `<div class="empty-state"><div class="empty-mark" aria-hidden="true">${hasFilters ? "⌕" : "✓"}</div><h3>${hasFilters ? "No matching tasks" : "Your list is clear"}</h3><p>${hasFilters ? "Try adjusting your search or filters." : "Add a task when there's something new to tackle."}</p>${hasFilters ? "" : '<button class="primary-button" type="button" data-add-task><span class="plus" aria-hidden="true">+</span><span>Add a task</span></button>'}</div>`;
		return;
	}

	taskList.innerHTML = visibleTasks.map((task) => `
		<article class="task-card${task.completed ? " done" : ""}" data-task-id="${escapeAttribute(task.id)}">
			<button class="check-button" type="button" data-action="toggle" aria-label="${task.completed ? "Mark as not completed" : "Mark as completed"}" aria-pressed="${task.completed}">✓</button>
			<div class="task-main">
				<div class="task-title-row"><h3 class="task-title">${escapeHtml(task.title)}</h3><span class="priority ${escapeAttribute(task.priority)}">${escapeHtml(task.priority)}</span></div>
				<p class="task-description">${escapeHtml(task.description || "")}</p>
				<div class="task-meta"><span>${dueLabel(task)}</span></div>
			</div>
			<div class="task-actions">
				<button class="icon-button" type="button" data-action="edit" aria-label="Edit ${escapeAttribute(task.title)}" title="Edit task">Edit</button>
				<button class="icon-button delete" type="button" data-action="delete" aria-label="Delete ${escapeAttribute(task.title)}" title="Delete task">×</button>
			</div>
		</article>
	`).join("");
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => ({
		"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
	})[character]);
}

function escapeAttribute(value) {
	return escapeHtml(value);
}

function render() {
	updateOverview();
	renderTasks();
}

function showToast(message) {
	const region = document.querySelector("#toast-region");
	region.innerHTML = `<div class="toast" role="status">${escapeHtml(message)}</div>`;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => { region.innerHTML = ""; }, 2600);
}

function openTaskDialog(task) {
	taskForm.reset();
	document.querySelector("#task-id").value = task?.id ?? "";
	document.querySelector("#task-title-input").value = task?.title ?? "";
	document.querySelector("#task-description-input").value = task?.description ?? "";
	document.querySelector("#task-due-input").value = task?.dueDate ?? today;
	document.querySelector("#task-priority-input").value = task?.priority ?? "medium";
	document.querySelector("#dialog-title").textContent = task ? "Edit task" : "Add a task";
	document.querySelector("#save-task-button").textContent = task ? "Save changes" : "Add task";
	taskDialog.showModal();
	document.querySelector("#task-title-input").focus();
}

document.querySelectorAll("[data-add-task]").forEach((button) => button.addEventListener("click", () => openTaskDialog()));
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => taskDialog.close()));

taskDialog.addEventListener("click", (event) => {
	if (event.target === taskDialog) taskDialog.close();
});

taskForm.addEventListener("submit", (event) => {
	event.preventDefault();
	if (!taskForm.reportValidity()) return;
	const id = document.querySelector("#task-id").value;
	const task = {
		id: id || makeId(),
		title: document.querySelector("#task-title-input").value.trim(),
		description: document.querySelector("#task-description-input").value.trim(),
		dueDate: document.querySelector("#task-due-input").value,
		priority: document.querySelector("#task-priority-input").value,
		completed: id ? tasks.find((item) => item.id === id).completed : false
	};
	if (id) {
		tasks = tasks.map((item) => item.id === id ? task : item);
	} else {
		tasks.push(task);
	}
	saveTasks();
	render();
	taskDialog.close();
	showToast(id ? "Task updated" : "Task added to your list");
});

taskList.addEventListener("click", (event) => {
	const button = event.target.closest("[data-action]");
	if (!button) return;
	const card = button.closest("[data-task-id]");
	const task = tasks.find((item) => item.id === card.dataset.taskId);
	if (!task) return;

	if (button.dataset.action === "toggle") {
		task.completed = !task.completed;
		saveTasks();
		render();
		showToast(task.completed ? "Task completed" : "Task marked to do");
	}
	if (button.dataset.action === "edit") openTaskDialog(task);
	if (button.dataset.action === "delete") {
		tasks = tasks.filter((item) => item.id !== task.id);
		saveTasks();
		render();
		showToast("Task deleted");
	}
});

document.querySelectorAll("[data-view]").forEach((button) => {
	button.addEventListener("click", () => {
		selectedView = button.dataset.view;
		document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
		renderTasks();
	});
});

statusFilter.addEventListener("change", renderTasks);
priorityFilter.addEventListener("change", renderTasks);
searchInput.addEventListener("input", renderTasks);
updateDateLabel();
render();
