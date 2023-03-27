
function createEmail(item, remainingDays, url) {
    text = `<!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Erinnerung: Abholung von Lagergegenstand</title>
        <style>
          /* Hier können Sie Ihre CSS-Regeln einfügen */
        </style>
      </head>
      <body>
        <h1>FabLab Lübeck Erinnerung: Abholung von Lagergegenstand</h1>
        <p>Hallo lieber Maker,</p>
        <p>
          wir möchten Sie daran erinnern, dass die Lagerzeit im Keller vom FabLab Lübeck von
          <strong>${item.description}</strong>`;
    if (remainingDays > 0) {
        text = text + ` in ${remainingDays} Tagen abläuft. Dieser Gegenstand
        wurde im Keller an Platz <strong>${item.storageLocation}</strong> eingelagert.
      </p>`;
    } else if (remainingDays == 0) {
        text = text + ` heute Abläuft. Dieser Gegenstand
        wurde im Regal an Platz <strong>${item.storageLocation}</strong> eingelagert.
      </p>`;
    } else {
        text = text + ` abgelaufen ist. Dieser Gegenstand
        wurde im Regal an Platz <strong>${item.storageLocation}</strong> eingelagert
        und ist seit <strong>${remainingDays}</strong> Tagen fällig zur Abholung.
      </p>`;
    }
    return text + `       <p>
            Bitte holen Sie den Gegenstand zeitnah bei uns ab oder verlängern Sie die
            Lagerzeit im <a href="${url}">Lagersystem</a>. So vermeiden Sie zusätzliche Kosten und unnötigen
            Aufwand.
        </p>
        <p>
          Bei Fragen oder Problemen können Sie sich gerne jederzeit an unser Team
          wenden.
        </p>
        <p>Viele Grüße,<br />Ihr Lager-Team</p>
        <hr />
        <p>
          <small>
            Diese E-Mail wurde automatisch generiert. Wenn die sich abmelden wollen löschen sie bitte ihren Acc auf dem <a href="${url}">Lagersystem</a>.
          </small>
        </p>
      </body>
    </html>
    `;
}

module.exports.createEmail = createEmail;
