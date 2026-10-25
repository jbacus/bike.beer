import { carbGramsPerOz, planBurn, TripMode } from '../src';

declare const __BUILD_INFO__: string;

const form = document.getElementById('form') as HTMLFormElement;
const result = document.getElementById('result') as HTMLElement;
const carbHint = document.getElementById('carbHint') as HTMLElement;

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(): void {
  const data = new FormData(form);
  const str = (k: string) => String(data.get(k) ?? '');
  const num = (k: string) => parseFloat(str(k));

  const style = str('style');
  carbHint.textContent = `Residual carbs for this style: ${carbGramsPerOz(style)} g/oz`;

  try {
    const plan = planBurn(
      { name: str('name'), style, abv: num('abv'), servingOz: num('servingOz') },
      num('directMiles'),
      { weightLbs: num('weightLbs'), speedMph: num('speedMph') },
      str('tripMode') as TripMode,
    );
    const name = escapeHtml(str('name') || 'This beer');
    const verdict = plan.isCoveredByDirectRide
      ? `<p class="verdict ok">Covered. The ride burns ${fmt(plan.netCalorieBalance)} kcal more than ${name} contains.</p>`
      : `<p class="verdict short">Add a <strong>${fmt(plan.detourMiles, 1)} mi</strong> loop on the way there to break even.</p>`;

    result.innerHTML = `
      ${verdict}
      <dl class="stats">
        <div><dt>Beer</dt><dd>${fmt(plan.beerCalories)} kcal</dd></div>
        <div><dt>Burn rate</dt><dd>${fmt(plan.caloriesPerMile, 1)} kcal/mi</dd></div>
        <div><dt>Direct ride burn</dt><dd>${fmt(plan.directBurn)} kcal over ${fmt(plan.countedMiles, 1)} mi</dd></div>
        <div><dt>Total ride</dt><dd>${fmt(plan.totalMiles, 1)} mi</dd></div>
      </dl>`;
  } catch (err) {
    result.innerHTML = `<p class="verdict error">${escapeHtml((err as Error).message)}</p>`;
  }
}

form.addEventListener('input', render);
(document.getElementById('build') as HTMLElement).textContent = __BUILD_INFO__;
render();
