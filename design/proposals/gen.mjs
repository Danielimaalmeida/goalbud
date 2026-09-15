// Generates the .dc.html artboards for the two Goalbud design proposals.
// Run: node design/proposals/gen.mjs   (writes into design/proposals/)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// ---------- shared icon set (stroke SVG, 24 grid) ----------
const ico = (paths, size = 22, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;
const I = {
  book: (s) => ico('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"></path><path d="M4 20.5V5.5"></path><path d="M8 7h8"></path>', s),
  walk: (s) => ico('<circle cx="13" cy="4" r="1.6"></circle><path d="M10.5 21l2-6-2.5-2.5V9l3 2 3 1.5"></path><path d="M13.5 15l3 6"></path><path d="M7 13l3-4"></path>', s),
  dumbbell: (s) => ico('<path d="M3 10v4"></path><path d="M6 8v8"></path><path d="M18 8v8"></path><path d="M21 10v4"></path><path d="M6 12h12"></path>', s),
  brush: (s) => ico('<path d="M14 3l7 7-9 9-4-4z"></path><path d="M8 15c-2 0-4 2-4 5 3 0 5-2 5-4"></path>', s),
  leaf: (s) => ico('<path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z"></path><path d="M5 19c3-4 6-7 10-9"></path>', s),
  moon: (s) => ico('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path>', s),
  check: (s) => ico('<path d="M5 12.5l4.5 4.5L19 7"></path>', s, 'stroke-width="2.25"'),
  plus: (s) => ico('<path d="M12 5v14"></path><path d="M5 12h14"></path>', s, 'stroke-width="2.25"'),
  chevron: (s) => ico('<path d="M9 6l6 6-6 6"></path>', s),
  back: (s) => ico('<path d="M15 6l-6 6 6 6"></path>', s),
  pause: (s) => ico('<path d="M9 5v14"></path><path d="M15 5v14"></path>', s),
  more: (s) => ico('<circle cx="6" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="18" cy="12" r="1"></circle>', s),
  flag: (s) => ico('<path d="M5 21V4"></path><path d="M5 4h12l-2 4 2 4H5"></path>', s),
  // tab icons
  today: (s) => ico('<rect x="3" y="5" width="18" height="16" rx="2.5"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path><circle cx="12" cy="15.5" r="1.5" fill="currentColor" stroke="none"></circle>', s),
  goals: (s) => ico('<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"></circle>', s),
  you: (s) => ico('<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5"></path>', s),
};

const wrap = (helmet, body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${helmet}
</helmet>
${body}
</x-dc>
</body>
</html>
`;

// =====================================================================
// DIRECTION A — "Warm Journal"
// =====================================================================
const A = {
  bg: '#f7f2e9', surface: '#fffdf8', ink: '#2b2622', muted: '#8a8078', faint: '#b9b0a5',
  line: '#e8e0d3', accent: '#b8714f', accentSoft: '#f3e4da',
  // 8-colour goal palette, oklch(0.72 0.10 h)
  pal: { peach: '#dba080', ochre: '#c9a56b', sage: '#a5b57a', mint: '#7cbba2', sky: '#79b6c9', peri: '#93a9e0', lilac: '#b89bdb', mauve: '#d493b6' },
};
const aHelmet = `  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&display=swap">
  <style>
    body { margin: 0; font-family: 'Instrument Sans', 'Segoe UI', system-ui, sans-serif; color: ${A.ink}; -webkit-font-smoothing: antialiased; }
    a { color: ${A.accent}; } a:hover { color: #9a5b3d; }
    .serif { font-family: 'Instrument Serif', Georgia, 'Times New Roman', serif; font-weight: 400; letter-spacing: -0.01em; }
  </style>`;

const aTabs = (active) => {
  const tab = (name, icon) => {
    const on = name === active;
    return `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1 1 0; color: ${on ? A.ink : A.faint}; min-height: 44px; justify-content: center;">${icon(22)}<span style="font-size: 11px; font-weight: ${on ? 600 : 500}; letter-spacing: 0.02em;">${name}</span></div>`;
  };
  return `<div style="display: flex; flex-direction: row; align-items: stretch; padding: 8px 12px 20px; border-top: 1px solid ${A.line}; background: ${A.surface};">
    ${tab('Today', I.today)}${tab('Goals', I.goals)}${tab('Workouts', I.dumbbell)}${tab('You', I.you)}
  </div>`;
};

const aPhone = (content, tab) => `<div style="width: 390px; height: 844px; background: ${A.bg}; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
  <div style="flex: 1 1 0; overflow: hidden; display: flex; flex-direction: column;">
${content}
  </div>
  ${aTabs(tab)}
</div>`;

// A: Today card. state: 'open' | 'done' | 'skipped'
const aCard = ({ name, meta, color, icon, action, state = 'open', parent }) => {
  const iconBox = `<div style="width: 40px; height: 40px; border-radius: 12px; background: ${color}33; color: ${color}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${icon ? icon(20) : ''}</div>`;
  const doneToggle = state === 'done'
    ? `<div style="width: 44px; height: 44px; border-radius: 22px; background: ${color}; color: ${A.surface}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${I.check(22)}</div>`
    : `<div style="width: 44px; height: 44px; border-radius: 22px; border: 1.5px solid ${A.line}; background: ${A.surface}; flex: 0 0 auto;"></div>`;
  let right = doneToggle;
  if (action === 'plus') right = `<div style="height: 44px; padding: 0 16px; border-radius: 22px; border: 1.5px solid ${A.ink}; color: ${A.ink}; display: flex; align-items: center; gap: 4px; font-weight: 600; font-size: 15px; flex: 0 0 auto;">${I.plus(16)}<span>1</span></div>`;
  if (action === 'log') right = `<div style="height: 44px; padding: 0 18px; border-radius: 22px; border: 1.5px solid ${A.ink}; color: ${A.ink}; display: flex; align-items: center; font-weight: 600; font-size: 15px; flex: 0 0 auto;">Log</div>`;
  if (action === 'workout') right = `<div style="height: 44px; padding: 0 18px; border-radius: 22px; background: ${A.ink}; color: ${A.surface}; display: flex; align-items: center; font-weight: 600; font-size: 15px; flex: 0 0 auto;">Start</div>`;
  if (state === 'skipped') {
    return `<div style="display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-radius: 18px; border: 1px dashed ${A.line}; background: transparent;">
      <div style="display: flex; flex-direction: row; align-items: center; gap: 14px;">
        <div style="width: 40px; height: 40px; border-radius: 12px; background: ${A.line}; color: ${A.muted}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${icon(20)}</div>
        <div style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 0;">
          <div style="font-size: 17px; font-weight: 500; color: ${A.muted};">${name}</div>
          <div style="font-size: 13px; color: ${A.faint};">Skipped today</div>
        </div>
      </div>
      <div class="serif" style="font-size: 17px; font-style: italic; color: ${A.muted}; padding-left: 54px;">Life happens. You can pick it up later.</div>
    </div>`;
  }
  return `<div style="display: flex; flex-direction: row; align-items: center; gap: 14px; padding: 14px 16px 14px 16px; border-radius: 18px; background: ${A.surface}; border: 1px solid ${A.line};">
    ${iconBox}
    <div style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 0; min-width: 0;">
      ${parent ? `<div style="font-size: 12px; color: ${A.faint}; display: flex; align-items: center; gap: 4px;">${I.flag(12)}<span>${parent}</span></div>` : ''}
      <div style="font-size: 17px; font-weight: 500; color: ${A.ink};">${name}</div>
      <div style="font-size: 13px; color: ${A.muted};">${meta}</div>
    </div>
    ${right}
  </div>`;
};

const aToday = aPhone(`
    <div style="padding: 60px 24px 12px; display: flex; flex-direction: column; gap: 4px;">
      <div style="font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${A.muted};">Monday</div>
      <div class="serif" style="font-size: 40px; line-height: 1.05;">15 September</div>
      <div style="font-size: 15px; color: ${A.muted}; margin-top: 6px;">2 done, 4 open</div>
    </div>
    <div style="padding: 8px 16px 24px; display: flex; flex-direction: column; gap: 10px; flex: 1 1 0; overflow: hidden;">
      ${aCard({ name: 'Read 20 min', meta: 'Every day', color: A.pal.ochre, icon: I.book, state: 'done' })}
      ${aCard({ name: 'Walk', meta: '2 this week · 3 a week', color: A.pal.sage, icon: I.walk, action: 'plus' })}
      ${aCard({ name: 'Push day', meta: 'Mon, Wed, Fri · workout', color: A.pal.sky, icon: I.dumbbell, action: 'workout' })}
      ${aCard({ name: 'Paint 30 min', meta: 'Every day', color: A.pal.lilac, icon: I.brush, parent: 'Finish the painting' })}
      ${aCard({ name: 'Stretch', meta: 'Whenever', color: A.pal.mint, icon: I.leaf, action: 'log' })}
      ${aCard({ name: 'Meditate', meta: 'Every day', color: A.pal.peri, icon: I.moon, state: 'skipped' })}
    </div>`, 'Today');

// A: Goals list
const aRow = ({ name, meta, color, icon, child, paused }) => `<div style="display: flex; flex-direction: row; align-items: center; gap: 14px; padding: 12px 16px 12px ${child ? 44 : 16}px; min-height: 56px; box-sizing: border-box; opacity: ${paused ? 0.6 : 1};">
    <div style="width: 32px; height: 32px; border-radius: 10px; background: ${color}33; color: ${color}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${icon ? icon(18) : ''}</div>
    <div style="display: flex; flex-direction: column; gap: 1px; flex: 1 1 0;">
      <div style="font-size: 16px; font-weight: 500;">${name}</div>
      <div style="font-size: 13px; color: ${A.muted};">${meta}</div>
    </div>
    <div style="color: ${A.faint};">${paused ? I.pause(18) : I.chevron(18)}</div>
  </div>`;
const aSection = (title, rows) => `<div style="display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${A.muted}; padding: 0 8px;">${title}</div>
    <div style="display: flex; flex-direction: column; background: ${A.surface}; border: 1px solid ${A.line}; border-radius: 18px; overflow: hidden;">${rows}</div>
  </div>`;
const aGoals = aPhone(`
    <div style="padding: 60px 24px 12px; display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between;">
      <div class="serif" style="font-size: 40px; line-height: 1.05;">Goals</div>
      <div style="height: 44px; padding: 0 16px; border-radius: 22px; background: ${A.ink}; color: ${A.surface}; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 15px;">${I.plus(16)}<span>New</span></div>
    </div>
    <div style="padding: 8px 16px 24px; display: flex; flex-direction: column; gap: 14px; flex: 1 1 0; overflow: hidden;">
      ${aSection('Active', [
        aRow({ name: 'Read 20 min', meta: 'Every day · 41 done', color: A.pal.ochre, icon: I.book }),
        aRow({ name: 'Walk', meta: '3 a week · 2 this week', color: A.pal.sage, icon: I.walk }),
        aRow({ name: 'Push day', meta: 'Mon, Wed, Fri · workout', color: A.pal.sky, icon: I.dumbbell }),
        aRow({ name: 'Stretch', meta: 'Whenever · 9 done', color: A.pal.mint, icon: I.leaf }),
        aRow({ name: 'Meditate', meta: 'Every day · 17 done', color: A.pal.peri, icon: I.moon }),
      ].join(''))}
      ${aSection('Long goals', [
        `<div style="display: flex; flex-direction: row; align-items: center; gap: 14px; padding: 14px 16px; min-height: 56px; box-sizing: border-box;">
          <div style="width: 32px; height: 32px; border-radius: 10px; background: ${A.pal.lilac}33; color: ${A.pal.lilac}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${I.flag(18)}</div>
          <div style="display: flex; flex-direction: column; gap: 1px; flex: 1 1 0;">
            <div class="serif" style="font-size: 20px;">Finish the painting</div>
            <div style="font-size: 13px; color: ${A.muted};">By 31 October · 12 sessions so far</div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 22px; border: 1.5px solid ${A.line}; background: ${A.surface}; flex: 0 0 auto;"></div>
        </div>`,
        aRow({ name: 'Paint 30 min', meta: 'Every day', color: A.pal.lilac, icon: I.brush, child: true }),
      ].join(''))}
      ${aSection('Paused', aRow({ name: 'Swim', meta: 'Every 3 days', color: A.pal.peach, icon: null, paused: true }))}
      <div style="font-size: 15px; color: ${A.accent}; padding: 4px 8px; font-weight: 500;">Archived goals</div>
    </div>`, 'Goals');

// A: Session
const aSet = ({ n, reps, kg, dur, state, edit }) => {
  const val = dur ? `${dur}` : `${reps} × ${kg} kg`;
  const done = state === 'done';
  return `<div style="display: flex; flex-direction: row; align-items: center; gap: 12px; min-height: 52px; padding: 4px 0;">
    <div style="width: 28px; font-size: 13px; color: ${A.faint}; font-weight: 600;">${n}</div>
    <div style="flex: 1 1 0; font-size: 17px; font-weight: 500; color: ${done ? A.muted : A.ink}; display: flex; align-items: center; gap: 8px;">
      <span>${val}</span>${edit ? `<span style="font-size: 12px; color: ${A.accent}; font-weight: 600;">edit</span>` : ''}
    </div>
    ${done
      ? `<div style="width: 44px; height: 44px; border-radius: 22px; background: ${A.pal.sky}; color: ${A.surface}; display: flex; align-items: center; justify-content: center;">${I.check(20)}</div>`
      : `<div style="width: 44px; height: 44px; border-radius: 22px; border: 1.5px solid ${A.line}; background: ${A.surface};"></div>`}
  </div>`;
};
const aExercise = (name, kind, sets) => `<div style="display: flex; flex-direction: column; gap: 2px; padding: 14px 16px 10px; background: ${A.surface}; border: 1px solid ${A.line}; border-radius: 18px;">
    <div style="display: flex; flex-direction: row; align-items: baseline; justify-content: space-between;">
      <div class="serif" style="font-size: 22px;">${name}</div>
      <div style="font-size: 12px; color: ${A.faint}; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;">${kind}</div>
    </div>
    <div style="display: flex; flex-direction: column;">${sets}</div>
  </div>`;
const aSession = `<div style="width: 390px; height: 844px; background: ${A.bg}; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
  <div style="padding: 54px 16px 8px 12px; display: flex; flex-direction: row; align-items: center; gap: 8px;">
    <div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: ${A.ink};">${I.back(24)}</div>
    <div style="display: flex; flex-direction: column; flex: 1 1 0;">
      <div class="serif" style="font-size: 28px; line-height: 1.05;">Push day</div>
      <div style="font-size: 13px; color: ${A.muted};">Started 18:04</div>
    </div>
    <div class="serif" style="font-size: 30px; font-variant-numeric: tabular-nums; color: ${A.ink};">24:13</div>
  </div>
  <div style="margin: 8px 16px 0; padding: 14px 18px; border-radius: 18px; background: ${A.accentSoft}; display: flex; flex-direction: row; align-items: center; justify-content: space-between;">
    <div style="display: flex; flex-direction: column; gap: 1px;">
      <div style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${A.accent};">Rest</div>
      <div class="serif" style="font-size: 34px; line-height: 1; font-variant-numeric: tabular-nums; color: ${A.ink};">0:47</div>
    </div>
    <div style="height: 44px; padding: 0 18px; border-radius: 22px; border: 1.5px solid ${A.accent}; color: ${A.accent}; display: flex; align-items: center; font-weight: 600; font-size: 15px;">Skip rest</div>
  </div>
  <div style="padding: 12px 16px 0; display: flex; flex-direction: column; gap: 10px; flex: 1 1 0; overflow: hidden;">
    ${aExercise('Bench press', 'Reps · kg', [
      aSet({ n: 1, reps: 8, kg: 60, state: 'done' }),
      aSet({ n: 2, reps: 8, kg: 60, state: 'done' }),
      aSet({ n: 3, reps: 8, kg: 60, edit: true }),
    ].join(''))}
    ${aExercise('Overhead press', 'Reps · kg', [
      aSet({ n: 1, reps: 10, kg: 30 }),
      aSet({ n: 2, reps: 10, kg: 30 }),
    ].join(''))}
    ${aExercise('Plank', 'Time', aSet({ n: 1, dur: '45 s' }))}
  </div>
  <div style="padding: 12px 16px 28px; display: flex;">
    <div style="flex: 1 1 0; height: 52px; border-radius: 26px; background: ${A.ink}; color: ${A.surface}; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 17px;">Finish workout</div>
  </div>
</div>`;

// A: History (month calendar): filled dot = done, dash = skipped, blank otherwise
const monthCells = (marks, cell) => {
  // September 2026 starts on a Tuesday (Mon-first grid => 1 leading blank), 30 days
  const out = [];
  out.push(cell(null));
  for (let d = 1; d <= 30; d++) out.push(cell(d, marks[d]));
  while (out.length % 7) out.push(cell(null));
  return out.join('');
};
const septMarks = { 1: 'done', 2: 'done', 3: 'done', 5: 'done', 6: 'done', 7: 'done', 8: 'skip', 9: 'done', 10: 'done', 12: 'done', 13: 'done', 14: 'done', 15: 'done' };
const aHistory = `<div style="width: 390px; height: 844px; background: ${A.bg}; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
  <div style="padding: 54px 16px 8px 12px; display: flex; flex-direction: row; align-items: center; gap: 8px;">
    <div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: ${A.ink};">${I.back(24)}</div>
    <div style="width: 36px; height: 36px; border-radius: 11px; background: ${A.pal.ochre}33; color: ${A.pal.ochre}; display: flex; align-items: center; justify-content: center;">${I.book(18)}</div>
    <div style="display: flex; flex-direction: column; flex: 1 1 0;">
      <div class="serif" style="font-size: 28px; line-height: 1.05;">Read 20 min</div>
      <div style="font-size: 13px; color: ${A.muted};">Every day</div>
    </div>
    <div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: ${A.muted};">${I.more(22)}</div>
  </div>
  <div style="padding: 12px 16px 0; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; flex-direction: row; gap: 10px;">
      <div style="flex: 1 1 0; padding: 14px 16px; border-radius: 18px; background: ${A.surface}; border: 1px solid ${A.line}; display: flex; flex-direction: column; gap: 2px;">
        <div class="serif" style="font-size: 32px; line-height: 1;">41</div>
        <div style="font-size: 13px; color: ${A.muted};">done in total</div>
      </div>
      <div style="flex: 1 1 0; padding: 14px 16px; border-radius: 18px; background: ${A.surface}; border: 1px solid ${A.line}; display: flex; flex-direction: column; gap: 2px;">
        <div class="serif" style="font-size: 32px; line-height: 1;">13</div>
        <div style="font-size: 13px; color: ${A.muted};">this month</div>
      </div>
    </div>
    <div style="padding: 16px 12px 18px; border-radius: 18px; background: ${A.surface}; border: 1px solid ${A.line}; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 0 6px;">
        <div style="color: ${A.muted};">${I.back(20)}</div>
        <div class="serif" style="font-size: 22px;">September 2026</div>
        <div style="color: ${A.faint};">${I.chevron(20)}</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px;">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div style="text-align: center; font-size: 11px; font-weight: 600; color: ${A.faint}; letter-spacing: 0.06em;">${d}</div>`).join('')}
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px;">
        ${monthCells(septMarks, (d, m) => {
          if (d === null) return `<div style="height: 44px;"></div>`;
          const mark = m === 'done'
            ? `<div style="width: 10px; height: 10px; border-radius: 5px; background: ${A.pal.ochre};"></div>`
            : m === 'skip'
              ? `<div style="width: 10px; height: 2px; border-radius: 1px; background: ${A.faint};"></div>`
              : `<div style="width: 10px; height: 10px;"></div>`;
          const isToday = d === 15;
          return `<div style="height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; border-radius: 12px; ${isToday ? `border: 1.5px solid ${A.ink};` : ''}">
            <div style="font-size: 13px; color: ${d > 15 ? A.faint : A.ink}; font-weight: ${isToday ? 600 : 400};">${d}</div>${mark}
          </div>`;
        })}
      </div>
    </div>
    <div style="display: flex; flex-direction: row; gap: 16px; padding: 0 8px; font-size: 13px; color: ${A.muted};">
      <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 10px; height: 10px; border-radius: 5px; background: ${A.pal.ochre};"></div><span>Done</span></div>
      <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 10px; height: 2px; background: ${A.faint};"></div><span>Skipped</span></div>
    </div>
  </div>
  <div style="flex: 1 1 0;"></div>
  <div style="padding: 12px 16px 28px; display: flex; flex-direction: row; gap: 10px;">
    <div style="flex: 1 1 0; height: 48px; border-radius: 24px; border: 1.5px solid ${A.line}; background: ${A.surface}; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 15px;">Pause</div>
    <div style="flex: 1 1 0; height: 48px; border-radius: 24px; border: 1.5px solid ${A.line}; background: ${A.surface}; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 15px;">Edit</div>
  </div>
</div>`;

// =====================================================================
// DIRECTION B — "Ink & Signal"
// =====================================================================
const B = {
  bg: '#f3f5f7', surface: '#ffffff', ink: '#0f1419', muted: '#6b7580', faint: '#a3adb8',
  line: '#dde2e8', lineStrong: '#0f1419',
  // 8-colour goal palette, oklch(0.66 0.16 h), no red hue
  pal: { orange: '#d97a2b', olive: '#a29a1c', green: '#4faa5c', teal: '#2aa89a', blue: '#4a8ee0', indigo: '#7d7fe6', violet: '#b46bd9', pink: '#d9629f' },
};
const bHelmet = `  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap">
  <style>
    body { margin: 0; font-family: 'Archivo', 'Helvetica Neue', Arial, sans-serif; color: ${B.ink}; -webkit-font-smoothing: antialiased; }
    a { color: ${B.ink}; text-decoration: underline; } a:hover { color: ${B.muted}; }
    .mono { font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
  </style>`;

const bTabs = (active) => {
  const tab = (name, icon) => {
    const on = name === active;
    return `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1 1 0; color: ${on ? B.ink : B.faint}; min-height: 44px; justify-content: center; border-top: 2px solid ${on ? B.ink : 'transparent'}; padding-top: 8px;">${icon(22)}<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;">${name}</span></div>`;
  };
  return `<div style="display: flex; flex-direction: row; align-items: stretch; padding: 0 8px 18px; border-top: 1px solid ${B.line}; background: ${B.surface};">
    ${tab('Today', I.today)}${tab('Goals', I.goals)}${tab('Workouts', I.dumbbell)}${tab('You', I.you)}
  </div>`;
};
const bPhone = (content, tab) => `<div style="width: 390px; height: 844px; background: ${B.bg}; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
  <div style="flex: 1 1 0; overflow: hidden; display: flex; flex-direction: column;">
${content}
  </div>
  ${bTabs(tab)}
</div>`;

// B card: colour as a square chip, done inverts the card to ink
const bCard = ({ name, meta, color, icon, action, state = 'open', parent, count }) => {
  const done = state === 'done';
  const fg = done ? B.surface : B.ink;
  const sub = done ? '#b8c0c9' : B.muted;
  const chip = `<div style="width: 36px; height: 36px; border-radius: 6px; background: ${color}; color: ${B.surface}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${icon ? icon(20) : ''}</div>`;
  let right = done
    ? `<div style="width: 44px; height: 44px; border-radius: 6px; background: ${B.surface}; color: ${B.ink}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${I.check(24)}</div>`
    : `<div style="width: 44px; height: 44px; border-radius: 6px; border: 1.5px solid ${B.ink}; flex: 0 0 auto;"></div>`;
  if (action === 'plus') right = `<div style="display: flex; flex-direction: row; align-items: center; gap: 10px; flex: 0 0 auto;">
      <div class="mono" style="font-size: 28px; font-weight: 700; line-height: 1;">${count}<span style="font-size: 14px; color: ${B.muted}; font-weight: 500;">/wk</span></div>
      <div style="width: 44px; height: 44px; border-radius: 6px; background: ${B.ink}; color: ${B.surface}; display: flex; align-items: center; justify-content: center;">${I.plus(22)}</div>
    </div>`;
  if (action === 'log') right = `<div style="height: 44px; padding: 0 16px; border-radius: 6px; border: 1.5px solid ${B.ink}; display: flex; align-items: center; font-weight: 700; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; flex: 0 0 auto;">Log</div>`;
  if (action === 'workout') right = `<div style="height: 44px; padding: 0 16px; border-radius: 6px; background: ${color}; color: ${B.surface}; display: flex; align-items: center; font-weight: 700; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; flex: 0 0 auto;">Start</div>`;
  if (state === 'skipped') {
    return `<div style="display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border-radius: 8px; border: 1.5px dashed ${B.line};">
      <div style="display: flex; flex-direction: row; align-items: center; gap: 12px;">
        <div style="width: 36px; height: 36px; border-radius: 6px; background: ${B.line}; color: ${B.muted}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${icon(20)}</div>
        <div style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 0;">
          <div style="font-size: 17px; font-weight: 600; color: ${B.muted};">${name}</div>
          <div style="font-size: 13px; color: ${B.faint}; font-weight: 500;">Skipped today</div>
        </div>
      </div>
      <div style="font-size: 15px; color: ${B.muted}; font-weight: 500; padding-left: 48px;">Life happens. You can pick it up later.</div>
    </div>`;
  }
  return `<div style="display: flex; flex-direction: row; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 8px; background: ${done ? B.ink : B.surface}; border: 1.5px solid ${done ? B.ink : B.line};">
    ${chip}
    <div style="display: flex; flex-direction: column; gap: 2px; flex: 1 1 0; min-width: 0;">
      ${parent ? `<div style="font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${sub};">${parent}</div>` : ''}
      <div style="font-size: 17px; font-weight: 600; color: ${fg}; ${done ? '' : ''}">${name}</div>
      <div style="font-size: 13px; color: ${sub}; font-weight: 500;">${meta}</div>
    </div>
    ${right}
  </div>`;
};

const bToday = bPhone(`
    <div style="padding: 56px 20px 14px; display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between; gap: 12px;">
      <div style="display: flex; flex-direction: column; gap: 0;">
        <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${B.muted};">Today · Mon</div>
        <div style="font-size: 52px; font-weight: 800; line-height: 0.95; letter-spacing: -0.03em;">15 Sep</div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
        <div class="mono" style="font-size: 28px; font-weight: 700; line-height: 1;">2</div>
        <div style="font-size: 12px; font-weight: 600; color: ${B.muted}; text-transform: uppercase; letter-spacing: 0.06em;">done</div>
      </div>
    </div>
    <div style="padding: 0 16px 20px; display: flex; flex-direction: column; gap: 8px; flex: 1 1 0; overflow: hidden;">
      ${bCard({ name: 'Read 20 min', meta: 'Every day', color: B.pal.olive, icon: I.book, state: 'done' })}
      ${bCard({ name: 'Walk', meta: '3 a week', color: B.pal.green, icon: I.walk, action: 'plus', count: 2 })}
      ${bCard({ name: 'Push day', meta: 'Mon Wed Fri · workout', color: B.pal.blue, icon: I.dumbbell, action: 'workout' })}
      ${bCard({ name: 'Paint 30 min', meta: 'Every day', color: B.pal.violet, icon: I.brush, parent: 'Finish the painting' })}
      ${bCard({ name: 'Stretch', meta: 'Whenever', color: B.pal.teal, icon: I.leaf, action: 'log' })}
      ${bCard({ name: 'Meditate', meta: 'Every day', color: B.pal.indigo, icon: I.moon, state: 'skipped' })}
    </div>`, 'Today');

// B: Goals
const bRow = ({ name, meta, color, icon, child, paused, big }) => `<div style="display: flex; flex-direction: row; align-items: center; gap: 12px; padding: 12px 16px 12px ${child ? 44 : 16}px; min-height: 56px; box-sizing: border-box; border-top: 1px solid ${B.line}; opacity: ${paused ? 0.55 : 1};">
    <div style="width: 28px; height: 28px; border-radius: 5px; background: ${color}; color: ${B.surface}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${icon ? icon(16) : ''}</div>
    <div style="display: flex; flex-direction: column; gap: 1px; flex: 1 1 0;">
      <div style="font-size: ${big ? 18 : 16}px; font-weight: ${big ? 700 : 600};">${name}</div>
      <div style="font-size: 13px; color: ${B.muted}; font-weight: 500;">${meta}</div>
    </div>
    <div style="color: ${B.faint};">${paused ? I.pause(18) : I.chevron(18)}</div>
  </div>`;
const bSection = (title, rows, n) => `<div style="display: flex; flex-direction: column; gap: 6px;">
    <div style="display: flex; flex-direction: row; align-items: baseline; gap: 8px; padding: 0 4px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">${title}</div>
      <div class="mono" style="font-size: 12px; color: ${B.muted};">${n}</div>
    </div>
    <div style="display: flex; flex-direction: column; background: ${B.surface}; border: 1.5px solid ${B.line}; border-radius: 8px; overflow: hidden; margin-top: -1px;">${rows}</div>
  </div>`;
const bGoals = bPhone(`
    <div style="padding: 56px 20px 14px; display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between;">
      <div style="font-size: 52px; font-weight: 800; line-height: 0.95; letter-spacing: -0.03em;">Goals</div>
      <div style="width: 48px; height: 48px; border-radius: 6px; background: ${B.ink}; color: ${B.surface}; display: flex; align-items: center; justify-content: center;">${I.plus(24)}</div>
    </div>
    <div style="padding: 0 16px 20px; display: flex; flex-direction: column; gap: 16px; flex: 1 1 0; overflow: hidden;">
      ${bSection('Active', [
        bRow({ name: 'Read 20 min', meta: 'Every day · 41 done', color: B.pal.olive, icon: I.book }),
        bRow({ name: 'Walk', meta: '3 a week · 2 this week', color: B.pal.green, icon: I.walk }),
        bRow({ name: 'Push day', meta: 'Mon Wed Fri · workout', color: B.pal.blue, icon: I.dumbbell }),
        bRow({ name: 'Stretch', meta: 'Whenever · 9 done', color: B.pal.teal, icon: I.leaf }),
        bRow({ name: 'Meditate', meta: 'Every day · 17 done', color: B.pal.indigo, icon: I.moon }),
      ].join(''), 5)}
      ${bSection('Long', [
        `<div style="display: flex; flex-direction: row; align-items: center; gap: 12px; padding: 14px 16px; min-height: 56px; box-sizing: border-box;">
          <div style="width: 28px; height: 28px; border-radius: 5px; background: ${B.pal.violet}; color: ${B.surface}; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;">${I.flag(16)}</div>
          <div style="display: flex; flex-direction: column; gap: 1px; flex: 1 1 0;">
            <div style="font-size: 18px; font-weight: 700;">Finish the painting</div>
            <div style="font-size: 13px; color: ${B.muted}; font-weight: 500;">By 31 Oct · <span class="mono">12</span> sessions so far</div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 6px; border: 1.5px solid ${B.ink}; flex: 0 0 auto;"></div>
        </div>`,
        bRow({ name: 'Paint 30 min', meta: 'Every day', color: B.pal.violet, icon: I.brush, child: true }),
      ].join(''), 1)}
      ${bSection('Paused', bRow({ name: 'Swim', meta: 'Every 3 days', color: B.pal.orange, icon: null, paused: true }), 1)}
      <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px; text-decoration: underline;">Archived</div>
    </div>`, 'Goals');

// B: Session
const bSet = ({ n, reps, kg, dur, state, edit }) => {
  const done = state === 'done';
  const cells = dur
    ? `<div class="mono" style="font-size: 20px; font-weight: 700; flex: 1 1 0; color: ${done ? B.muted : B.ink};">${dur}</div>`
    : `<div style="display: flex; flex-direction: row; gap: 14px; flex: 1 1 0; align-items: baseline;">
        <div class="mono" style="font-size: 20px; font-weight: 700; color: ${done ? B.muted : B.ink};">${reps}<span style="font-size: 12px; color: ${B.muted}; font-weight: 500;"> reps</span></div>
        <div class="mono" style="font-size: 20px; font-weight: 700; color: ${done ? B.muted : B.ink};">${kg}<span style="font-size: 12px; color: ${B.muted}; font-weight: 500;"> kg</span></div>
      </div>`;
  return `<div style="display: flex; flex-direction: row; align-items: center; gap: 12px; min-height: 52px; padding: 2px 16px; border-top: 1px solid ${B.line}; ${edit ? `background: ${B.bg};` : ''}">
    <div class="mono" style="width: 22px; font-size: 12px; color: ${B.faint}; font-weight: 700;">${String(n).padStart(2, '0')}</div>
    ${cells}
    ${done
      ? `<div style="width: 44px; height: 44px; border-radius: 6px; background: ${B.ink}; color: ${B.surface}; display: flex; align-items: center; justify-content: center;">${I.check(22)}</div>`
      : `<div style="width: 44px; height: 44px; border-radius: 6px; border: 1.5px solid ${B.ink}; background: ${B.surface};"></div>`}
  </div>`;
};
const bExercise = (name, kind, sets) => `<div style="display: flex; flex-direction: column; background: ${B.surface}; border: 1.5px solid ${B.line}; border-radius: 8px; overflow: hidden;">
    <div style="display: flex; flex-direction: row; align-items: baseline; justify-content: space-between; padding: 12px 16px 10px;">
      <div style="font-size: 18px; font-weight: 700;">${name}</div>
      <div style="font-size: 11px; color: ${B.muted}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">${kind}</div>
    </div>
    ${sets}
  </div>`;
const bSession = `<div style="width: 390px; height: 844px; background: ${B.bg}; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
  <div style="padding: 52px 16px 10px 10px; display: flex; flex-direction: row; align-items: center; gap: 6px;">
    <div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">${I.back(24)}</div>
    <div style="display: flex; flex-direction: column; flex: 1 1 0;">
      <div style="font-size: 24px; font-weight: 800; line-height: 1; letter-spacing: -0.02em;">Push day</div>
      <div style="font-size: 12px; color: ${B.muted}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 3px;">Live · since 18:04</div>
    </div>
    <div class="mono" style="font-size: 30px; font-weight: 700; line-height: 1;">24:13</div>
  </div>
  <div style="margin: 0 16px; padding: 0 16px; height: 64px; border-radius: 8px; background: ${B.ink}; color: ${B.surface}; display: flex; flex-direction: row; align-items: center; justify-content: space-between;">
    <div style="display: flex; flex-direction: row; align-items: baseline; gap: 10px;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #b8c0c9;">Rest</div>
      <div class="mono" style="font-size: 32px; font-weight: 700; line-height: 1;">0:47</div>
    </div>
    <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; text-decoration: underline; padding: 12px 0;">Skip</div>
  </div>
  <div style="padding: 10px 16px 0; display: flex; flex-direction: column; gap: 8px; flex: 1 1 0; overflow: hidden;">
    ${bExercise('Bench press', 'Reps · kg', [
      bSet({ n: 1, reps: 8, kg: 60, state: 'done' }),
      bSet({ n: 2, reps: 8, kg: 60, state: 'done' }),
      bSet({ n: 3, reps: 8, kg: 60, edit: true }),
    ].join(''))}
    ${bExercise('Overhead press', 'Reps · kg', [
      bSet({ n: 1, reps: 10, kg: 30 }),
      bSet({ n: 2, reps: 10, kg: 30 }),
    ].join(''))}
    ${bExercise('Plank', 'Time', bSet({ n: 1, dur: '0:45' }))}
  </div>
  <div style="padding: 10px 16px 26px; display: flex;">
    <div style="flex: 1 1 0; height: 52px; border-radius: 6px; background: ${B.pal.blue}; color: ${B.surface}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase;">Finish workout</div>
  </div>
</div>`;

// B: History
const bHistory = `<div style="width: 390px; height: 844px; background: ${B.bg}; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box;">
  <div style="padding: 52px 16px 10px 10px; display: flex; flex-direction: row; align-items: center; gap: 6px;">
    <div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">${I.back(24)}</div>
    <div style="width: 32px; height: 32px; border-radius: 6px; background: ${B.pal.olive}; color: ${B.surface}; display: flex; align-items: center; justify-content: center;">${I.book(18)}</div>
    <div style="display: flex; flex-direction: column; flex: 1 1 0; padding-left: 4px;">
      <div style="font-size: 24px; font-weight: 800; line-height: 1; letter-spacing: -0.02em;">Read 20 min</div>
      <div style="font-size: 12px; color: ${B.muted}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 3px;">Every day</div>
    </div>
    <div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: ${B.muted};">${I.more(22)}</div>
  </div>
  <div style="padding: 6px 16px 0; display: flex; flex-direction: column; gap: 8px;">
    <div style="display: flex; flex-direction: row; gap: 8px;">
      <div style="flex: 1 1 0; padding: 14px 16px; border-radius: 8px; background: ${B.surface}; border: 1.5px solid ${B.line}; display: flex; flex-direction: column; gap: 4px;">
        <div class="mono" style="font-size: 34px; font-weight: 700; line-height: 1;">41</div>
        <div style="font-size: 11px; font-weight: 700; color: ${B.muted}; text-transform: uppercase; letter-spacing: 0.08em;">Done total</div>
      </div>
      <div style="flex: 1 1 0; padding: 14px 16px; border-radius: 8px; background: ${B.surface}; border: 1.5px solid ${B.line}; display: flex; flex-direction: column; gap: 4px;">
        <div class="mono" style="font-size: 34px; font-weight: 700; line-height: 1;">13</div>
        <div style="font-size: 11px; font-weight: 700; color: ${B.muted}; text-transform: uppercase; letter-spacing: 0.08em;">This month</div>
      </div>
    </div>
    <div style="padding: 14px 12px 16px; border-radius: 8px; background: ${B.surface}; border: 1.5px solid ${B.line}; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 0 4px;">
        <div style="color: ${B.ink};">${I.back(20)}</div>
        <div style="font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Sep 2026</div>
        <div style="color: ${B.faint};">${I.chevron(20)}</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px;">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="mono" style="text-align: center; font-size: 11px; font-weight: 700; color: ${B.faint};">${d}</div>`).join('')}
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px;">
        ${monthCells(septMarks, (d, m) => {
          if (d === null) return `<div style="height: 44px;"></div>`;
          const isToday = d === 15;
          if (m === 'done') return `<div style="height: 44px; border-radius: 6px; background: ${B.pal.olive}; color: ${B.surface}; display: flex; align-items: center; justify-content: center; ${isToday ? `outline: 2px solid ${B.ink}; outline-offset: 1px;` : ''}"><span class="mono" style="font-size: 13px; font-weight: 700;">${d}</span></div>`;
          if (m === 'skip') return `<div style="height: 44px; border-radius: 6px; border: 1.5px solid ${B.line}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; box-sizing: border-box;"><span class="mono" style="font-size: 13px; color: ${B.muted};">${d}</span><div style="width: 10px; height: 2px; background: ${B.faint};"></div></div>`;
          return `<div style="height: 44px; border-radius: 6px; display: flex; align-items: center; justify-content: center;"><span class="mono" style="font-size: 13px; color: ${d > 15 ? B.faint : B.muted};">${d}</span></div>`;
        })}
      </div>
    </div>
    <div style="display: flex; flex-direction: row; gap: 16px; padding: 2px 4px; font-size: 12px; font-weight: 600; color: ${B.muted};">
      <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 12px; height: 12px; border-radius: 3px; background: ${B.pal.olive};"></div><span>Done</span></div>
      <div style="display: flex; align-items: center; gap: 6px;"><div style="width: 12px; height: 2px; background: ${B.faint};"></div><span>Skipped</span></div>
    </div>
  </div>
  <div style="flex: 1 1 0;"></div>
  <div style="padding: 10px 16px 26px; display: flex; flex-direction: row; gap: 8px;">
    <div style="flex: 1 1 0; height: 48px; border-radius: 6px; border: 1.5px solid ${B.ink}; background: ${B.surface}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;">Pause</div>
    <div style="flex: 1 1 0; height: 48px; border-radius: 6px; border: 1.5px solid ${B.ink}; background: ${B.surface}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;">Edit</div>
  </div>
</div>`;

// ---------- write files ----------
const files = {
  'Main.dc.html': wrap(aHelmet, aToday),
  'WarmGoals.dc.html': wrap(aHelmet, aGoals),
  'WarmSession.dc.html': wrap(aHelmet, aSession),
  'WarmHistory.dc.html': wrap(aHelmet, aHistory),
  'InkToday.dc.html': wrap(bHelmet, bToday),
  'InkGoals.dc.html': wrap(bHelmet, bGoals),
  'InkSession.dc.html': wrap(bHelmet, bSession),
  'InkHistory.dc.html': wrap(bHelmet, bHistory),
};
for (const [name, src] of Object.entries(files)) writeFileSync(join(here, name), src);

const W = 390, H = 844, GAP = 90, ROW = H + 170;
const row = (y, names, prefix) => names.map((n, i) => ({ file: n[0], title: `${prefix} · ${n[1]}`, x: i * (W + GAP), y, w: W, h: H }));
const canvas = {
  artboards: [
    ...row(0, [['Main.dc.html', 'Today'], ['WarmGoals.dc.html', 'Goals'], ['WarmSession.dc.html', 'Live session'], ['WarmHistory.dc.html', 'Goal history']], 'A Warm Journal'),
    ...row(ROW, [['InkToday.dc.html', 'Today'], ['InkGoals.dc.html', 'Goals'], ['InkSession.dc.html', 'Live session'], ['InkHistory.dc.html', 'Goal history']], 'B Ink & Signal'),
  ],
  annotations: [
    { id: 'dir-a', x: -420, y: 0, w: 340, text: 'A · Warm Journal\n\nPaper-toned background, Instrument Serif headings, soft rounded cards, muted 8-colour palette. Reads like a notebook: calm and kind, which fits "never shames".\n\nTradeoff: lower contrast and a gentler hierarchy; the live workout screen has less punch mid-set.' },
    { id: 'dir-b', x: -420, y: ROW, w: 340, text: 'B · Ink & Signal\n\nCool near-white ground, near-black ink, Archivo headings, JetBrains Mono for every number, 6px corners, saturated colour chips. A done card inverts to ink. Reads like a tool: fast to scan one-handed at the gym.\n\nTradeoff: the bold, uppercase voice can feel stern; needs care so it stays light rather than drill-sergeant.' },
    { id: 'shared', x: -420, y: 460, w: 340, text: 'Both directions pass the no-shame rules: counts of done only, skipped days as a neutral dash, undone days blank, no red, no streaks, no percentages.\n\nStatic mockups. Sample goal names and numbers are placeholders.' },
  ],
  launch: { view: 'canvas' },
};
writeFileSync(join(here, 'canvas.json'), JSON.stringify(canvas, null, 2) + '\n');
console.log('wrote', Object.keys(files).length, 'artboards + canvas.json');
