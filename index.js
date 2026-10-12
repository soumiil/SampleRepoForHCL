const STORAGE_KEY = "daymark-tasks-v1";
const SUBJECT_STORAGE_KEY = "daymark-subjects-v1";
const taskList = document.querySelector("#task-list");
const taskDialog = document.querySelector("#task-dialog");
const taskForm = document.querySelector("#task-form");
const subjectList = document.querySelector("#subject-list");
const subjectDialog = document.querySelector("#subject-dialog");
const subjectForm = document.querySelector("#subject-form");
const statusFilter = document.querySelector("#status-filter");
const priorityFilter = document.querySelector("#priority-filter");
const searchInput = document.querySelector("#search-input");
const today = localDateString(new Date());

let selectedView = "all";
let toastTimer;
let tasks = loadTasks();
let subjects = loadSubjects();

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

function loadSubjects() {
    try {
        const saved = JSON.parse(localStorage.getItem(SUBJECT_STORAGE_KEY));
        if (Array.isArray(saved)) return saved;
    } catch (error) {
        console.warn("Could not read saved subjects.", error);
    }
    return [];
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
        showToast("Couldn't save tasks in this browser.");
        console.error("Could not save tasks.", error);
    }
}

function saveSubjects() {
    try {
        localStorage.setItem(SUBJECT_STORAGE_KEY, JSON.stringify(subjects));
    } catch (error) {
        showToast("Couldn't save subjects in this browser.");
        console.error("Could not save subjects.", error);
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
    document.querySelector('[data-nav-count="subjects"]').textContent = subjects.length;
}

function updateSubjectOverview() {
    const completion = subjects.length
        ? Math.round(subjects.reduce((total, item) => total + Number(item.progress || 0), 0) / subjects.length)
        : 0;
    const scoredSubjects = subjects.filter((item) => item.score !== null && item.score !== undefined && item.score !== "");
    const averageScore = scoredSubjects.length
        ? (scoredSubjects.reduce((total, item) => total + Number(item.score), 0) / scoredSubjects.length).toFixed(1)
        : "—";
    document.querySelector("#subject-completion").textContent = `${completion}%`;
    document.querySelector("#subject-progress-percent").textContent = `${completion}%`;
    document.querySelector("#subject-progress-ring").style.setProperty("--progress", `${completion}%`);
    document.querySelector("#subject-progress-ring").setAttribute("aria-label", `${completion}% prepared`);
    document.querySelector("#subject-score-average").textContent = averageScore === "—" ? averageScore : `${averageScore}/10`;
    document.querySelector("#subject-total").textContent = subjects.length;
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

function renderSubjects() {
    const query = document.querySelector("#subject-search").value.trim().toLocaleLowerCase();
    const type = document.querySelector("#subject-type-filter").value;
    const visibleSubjects = subjects.filter((item) => {
        const matchesType = type === "all" || item.kind === type;
        const matchesQuery = !query || `${item.name} ${item.description || ""}`.toLocaleLowerCase().includes(query);
        return matchesType && matchesQuery;
    }).sort((first, second) => first.name.localeCompare(second.name));
    document.querySelector("#subject-visible-count").textContent = `${visibleSubjects.length} ${visibleSubjects.length === 1 ? "entry" : "entries"}`;

    if (!visibleSubjects.length) {
        const hasFilter = query || type !== "all";
        subjectList.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-mark" aria-hidden="true">${hasFilter ? "⌕" : "▣"}</div><h3>${hasFilter ? "No matching entries" : "Start your preparation tracker"}</h3><p>${hasFilter ? "Try another search or type filter." : "Add your subjects and labs to see preparation progress in one place."}</p>${hasFilter ? "" : '<button class="primary-button" type="button" data-add-subject><span class="plus" aria-hidden="true">+</span><span>Add subject or lab</span></button>'}</div>`;
        return;
    }

    subjectList.innerHTML = visibleSubjects.map((item) => {
        const progress = Math.min(100, Math.max(0, Number(item.progress) || 0));
        const isPrepared = progress === 100;
        return `
			<article class="subject-card" data-subject-id="${escapeAttribute(item.id)}">
				<div class="subject-card-top">
					<div class="subject-heading"><span class="subject-type">${escapeHtml(item.kind)}</span><h3 class="subject-title">${escapeHtml(item.name)}</h3>${item.description ? `<p class="subject-description">${escapeHtml(item.description)}</p>` : ""}</div>
					<div class="subject-score">${Number(item.score || 0).toFixed(1)}<small>prep score / 10</small></div>
				</div>
				<div><div class="subject-progress-label"><span>Preparation</span><strong>${progress}%</strong></div><div class="subject-progress" role="progressbar" aria-label="${escapeAttribute(item.name)} preparation" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="subject-progress-fill" style="width:${progress}%"></div></div></div>
				<div class="subject-card-footer"><span class="prep-status">${isPrepared ? "Fully prepared" : progress ? "In preparation" : "Not started"}</span><div class="subject-actions"><button class="primary-button" type="button" data-subject-action="${isPrepared ? "edit" : "prepare"}">${isPrepared ? "Update" : "Mark prepared"}</button><button class="icon-button" type="button" data-subject-action="edit" aria-label="Edit ${escapeAttribute(item.name)}" title="Edit entry">Edit</button><button class="icon-button delete" type="button" data-subject-action="delete" aria-label="Delete ${escapeAttribute(item.name)}" title="Delete entry">×</button></div></div>
			</article>`;
    }).join("");
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
    updateSubjectOverview();
    const isSubjectsView = selectedView === "subjects";
    document.querySelector("#task-overview").hidden = isSubjectsView;
    document.querySelector("#task-panel").hidden = isSubjectsView;
    document.querySelector("#subject-overview").hidden = !isSubjectsView;
    document.querySelector("#subject-panel").hidden = !isSubjectsView;
    document.querySelector("[data-add-task]").hidden = isSubjectsView;
    document.querySelector("[data-add-subject]").hidden = !isSubjectsView;
    if (isSubjectsView) renderSubjects();
    else renderTasks();
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
document.querySelectorAll("[data-add-subject]").forEach((button) => button.addEventListener("click", () => openSubjectDialog()));
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => taskDialog.close()));
document.querySelectorAll("[data-close-subject-dialog]").forEach((button) => button.addEventListener("click", () => subjectDialog.close()));

taskDialog.addEventListener("click", (event) => {
    if (event.target === taskDialog) taskDialog.close();
});

subjectDialog.addEventListener("click", (event) => {
    if (event.target === subjectDialog) subjectDialog.close();
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

function openSubjectDialog(subject) {
    subjectForm.reset();
    document.querySelector("#subject-id").value = subject?.id ?? "";
    document.querySelector("#subject-name-input").value = subject?.name ?? "";
    document.querySelector("#subject-kind-input").value = subject?.kind ?? "subject";
    document.querySelector("#subject-description-input").value = subject?.description ?? "";
    document.querySelector("#subject-progress-input").value = subject?.progress ?? 0;
    document.querySelector("#subject-score-input").value = subject?.score ?? 0;
    document.querySelector("#subject-dialog-title").textContent = subject ? "Update preparation" : "Add a subject or lab";
    document.querySelector("#save-subject-button").textContent = subject ? "Save changes" : "Add to tracker";
    subjectDialog.showModal();
    document.querySelector("#subject-name-input").focus();
}

subjectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!subjectForm.reportValidity()) return;
    const id = document.querySelector("#subject-id").value;
    const subject = {
        id: id || makeId(),
        name: document.querySelector("#subject-name-input").value.trim(),
        kind: document.querySelector("#subject-kind-input").value,
        description: document.querySelector("#subject-description-input").value.trim(),
        progress: Number(document.querySelector("#subject-progress-input").value),
        score: Number(document.querySelector("#subject-score-input").value)
    };
    if (id) subjects = subjects.map((item) => item.id === id ? subject : item);
    else subjects.push(subject);
    saveSubjects();
    render();
    subjectDialog.close();
    showToast(id ? "Preparation updated" : "Added to your preparation tracker");
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
        render();
    });
});

subjectList.addEventListener("click", (event) => {
    if (event.target.closest("[data-add-subject]")) {
        openSubjectDialog();
        return;
    }
    const button = event.target.closest("[data-subject-action]");
    if (!button) return;
    const card = button.closest("[data-subject-id]");
    const subject = subjects.find((item) => item.id === card.dataset.subjectId);
    if (!subject) return;
    if (button.dataset.subjectAction === "edit") openSubjectDialog(subject);
    if (button.dataset.subjectAction === "prepare") {
        subject.progress = 100;
        saveSubjects();
        render();
        showToast(`${subject.name} marked prepared`);
    }
    if (button.dataset.subjectAction === "delete") {
        subjects = subjects.filter((item) => item.id !== subject.id);
        saveSubjects();
        render();
        showToast(`${subject.name} removed`);
    }
});

statusFilter.addEventListener("change", renderTasks);
priorityFilter.addEventListener("change", renderTasks);
searchInput.addEventListener("input", renderTasks);
document.querySelector("#subject-search").addEventListener("input", renderSubjects);
document.querySelector("#subject-type-filter").addEventListener("change", renderSubjects);
updateDateLabel();
render();
