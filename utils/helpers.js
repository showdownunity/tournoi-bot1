function isDeadlinePassed(deadlineStr) {
  // Format attendu : "14/05/2026 à 23h59" ou "14/05/2026"
  try {
    let cleaned = deadlineStr.replace(' à ', ' ').replace('h', ':');
    // ex: "14/05/2026 23:59"
    const parts = cleaned.split(' ');
    const dateParts = parts[0].split('/');
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const year = parseInt(dateParts[2]);

    let hours = 23, minutes = 59;
    if (parts[1]) {
      const timeParts = parts[1].split(':');
      hours = parseInt(timeParts[0]);
      minutes = parseInt(timeParts[1] || '0');
    }

    const deadline = new Date(year, month, day, hours, minutes, 0);
    return new Date() > deadline;
  } catch (e) {
    return false;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

module.exports = { isDeadlinePassed, generateId };
