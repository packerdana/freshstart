const PDFDocument = require('pdfkit');
const fs = require('fs');

const outPath = process.argv[2] || 'RouteWise_Marketing_Pitch.pdf';

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 54, bottom: 54, left: 54, right: 54 },
  info: {
    Title: 'RouteWise — Marketing Pitch (Letter Carriers)',
    Author: 'RouteWise',
  },
});

doc.pipe(fs.createWriteStream(outPath));

const H1 = (t) => {
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(t, { align: 'left' });
  doc.moveDown(0.4);
};

const H2 = (t) => {
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(t);
  doc.moveDown(0.15);
};

const P = (t) => {
  doc.font('Helvetica').fontSize(11).fillColor('#111827').text(t, { lineGap: 2 });
  doc.moveDown(0.35);
};

const Bullet = (items) => {
  doc.font('Helvetica').fontSize(11).fillColor('#111827');
  items.forEach((it) => {
    doc.text(`• ${it}`, { indent: 12, lineGap: 2 });
  });
  doc.moveDown(0.4);
};

const Divider = () => {
  doc.moveDown(0.2);
  const y = doc.y;
  doc.save();
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(1)
    .strokeColor('#e5e7eb')
    .stroke();
  doc.restore();
  doc.moveDown(0.6);
};

H1('RouteWise');
P('A carrier-first performance and prediction app for USPS city letter carriers.');

H2('One-line pitch');
P('RouteWise helps carriers confidently answer the morning “go-around” with an accurate return time — and stay confident on the street by showing whether they’re ahead or behind their own normal pace.');

H2('What problem it solves');
Bullet([
  'Morning “go-around” pressure: supervisors ask for a return-time estimate and may push unrealistic expectations.',
  'On-street uncertainty: it’s hard to know if you’re ahead/behind until it’s too late.',
  '3996 pressure: the most important paperwork is filled out in the morning before leaving. RouteWise helps you walk up with a defensible estimate + clear reasons.',
]);

Divider();

H2('What RouteWise does');
Bullet([
  'Predicts office time and street time for the day.',
  'Predicts a specific return/clock-out time (the number you give during the go-around).',
  'Tracks actual performance and learns from your history to improve predictions.',
  'Provides fun + useful stats (volume records, pace trends, consistency, “bad % to standard” days).',
]);

H2('How it works (in plain English)');
Bullet([
  'You enter your morning volumes (letters and flats in feet; parcels and SPRs as counts).',
  'When you hit Start Route (721), RouteWise captures your leave-office time and locks in your AM office minutes.',
  'As you complete waypoints, RouteWise records real timing and compares your pace to your historical average.',
  'At the end of the day, RouteWise saves the day’s volumes and times so tomorrow’s predictions get better.',
]);

Divider();

H2('Key features (carrier-first)');
Bullet([
  'Go-around helper: “Projected return: 4:30 PM (±X minutes)” — real clock time, not decimals',
  'Waypoint timing accuracy: predicted durations between waypoints based on your real history',
  'Ahead/Behind confidence: updated when you complete a waypoint (pace vs your last 10 clean days of the same day type)',
  '3996-ready reasons: quick, carrier-worded reasons you can use in the morning before you leave',
]);

H2('Privacy + trust (what to say publicly)');
Bullet([
  'Built by carriers for carriers.',
  'Stats and “% to standard” are for carrier reference only and are not contractually binding.',
  'Only collects what it needs to make predictions and show your stats.',
]);

Divider();

H2('Screenshots/video demo script (30–45 seconds)');
Bullet([
  'Show Today screen → enter volumes → prediction appears',
  'Tap Start Route (721) → it locks AM office time and shows projected return time',
  'Complete a waypoint → “Ahead/Behind vs your normal” appears',
  'End of day → see quick stats + summary',
]);

H2('Suggested pricing (launch)');
P('Start with a free beta. At launch, keep it simple and carrier-friendly:');
Bullet([
  '$4.99/month or $39.99/year with a 7–14 day free trial',
  'Optional: branch/steward discount codes for annual plans',
]);

H2('Call to action');
P('Want to test RouteWise? Join the beta and help shape the stats/features that carriers actually care about.');

// Footer
const footer = () => {
  doc.fontSize(9).fillColor('#6b7280');
  doc.text('RouteWise — carrier-first predictions and performance tracking', doc.page.margins.left, doc.page.height - 40, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    align: 'center',
  });
};

footer();

// Add footer on each new page
const origAddPage = doc.addPage.bind(doc);
doc.addPage = (...args) => {
  footer();
  origAddPage(...args);
  return doc;
};

doc.end();
console.log(`Wrote ${outPath}`);
