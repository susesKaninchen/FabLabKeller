// Finde alle Elemente mit der Klasse "remaining-time"
const remainingTimeElements = document.querySelectorAll('.remaining-days');

// Iteriere über jedes Element und setze die Hintergrundfarbe entsprechend der verbleibenden Tage
remainingTimeElements.forEach(element => {
  const remainingDays = parseInt(element.textContent.replace(/[^-?\d]/g, '')  );
  console.log("Days: " + remainingDays);
  if (remainingDays > 30) {
    element.style.backgroundColor = 'green';
  } else if (remainingDays > 1) {
    element.style.backgroundColor = 'yellow';
  } else {
    element.style.backgroundColor = 'red';
  }
});

