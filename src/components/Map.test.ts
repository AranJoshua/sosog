import { describe, test, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import type { MapStructure } from './Map.js';

// Set up a browser-like environment before React Testing Library loads.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement;
g.SVGElement = dom.window.SVGElement;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.MouseEvent = dom.window.MouseEvent;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;
// Skip zoom animation in tests.
dom.window.matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof dom.window.matchMedia;

const structures: MapStructure[] = [
  { id: 'barcelona-watch-tower', name: 'Barcelona Watch Tower', municipality: 'Barcelona', latitude: 12.867626, longitude: 124.143939, classification: 'Watchtowers', yearBuilt: '1800', materials: 'Stone Masonry', occupancy: 'Vacant', photo: '/structures/barcelona-lighthouse-thumb.jpg', summary: 'A stone watchtower.' },
  { id: 'barcelona-escuela-pia', name: 'Escuela Pia Barcelona', municipality: 'Barcelona', latitude: 12.867626, longitude: 124.143939, classification: 'Ruins/Landmark', yearBuilt: null, materials: null, occupancy: null, photo: null, summary: null },
  { id: 'barcelona-st-joseph', name: 'St. Joseph Church', municipality: 'Barcelona', latitude: 12.867341, longitude: 124.143447, classification: 'Churches', yearBuilt: '1871', materials: 'Coral Rocks', occupancy: 'Occupied', photo: null, summary: 'A coral stone church.' },
  { id: 'bulusan-san-bernardino-lighthouse', name: 'San Bernardino Lighthouse', municipality: 'Bulusan', latitude: 12.7530677, longitude: 124.2812294, classification: 'Lighthouse', yearBuilt: '1896', materials: 'Concrete', occupancy: 'Occupied', photo: null, summary: null }
];

type Rtl = typeof import('@testing-library/react');
let rtl: Rtl;
let ProvinceMap: typeof import('./Map.js').default;

before(async () => {
  rtl = await import('@testing-library/react');
  ProvinceMap = (await import('./Map.js')).default;
});

afterEach(() => rtl.cleanup());

const render = () => rtl.render(createElement(ProvinceMap, { structures }));

describe('ProvinceMap', () => {
  test('starts on the whole province: a list of all 15 municipalities, small dots, and no icon pins', () => {
    const { container } = render();
    const list = rtl.within(container.querySelector('aside') as HTMLElement);
    assert.equal(list.getAllByRole('button').filter((b) => /^(Barcelona|Bulan|Bulusan|Casiguran|Castilla|Donsol|Gubat|Irosin|Juban|Magallanes|Matnog|Pilar|Prieto Diaz|Santa Magdalena|Sorsogon City)/.test(b.textContent ?? '')).length, 15);
    assert.equal(container.querySelectorAll('circle[aria-hidden="true"]').length, structures.length);
    assert.equal(rtl.screen.queryAllByLabelText(/Open details/).length, 0);
  });

  test('keeps triangles out of the map: no pointed compass, and the Map key drops the browser disclosure triangle', () => {
    const { container } = render();
    const compass = container.querySelectorAll('svg')[1];
    assert.ok(compass, 'the compass svg is present');
    assert.equal(compass.querySelectorAll('polygon').length, 0);
    assert.ok(!/M32 8 40 32/.test(compass.innerHTML), 'the kite-shaped needle is gone');
    assert.ok(container.querySelector('details > summary.key-summary'), 'the Map key summary uses the custom marker');
  });

  test('widens the view to include an offshore structure', () => {
    const { container } = render();
    const viewBox = container.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number);
    assert.ok(viewBox[0] + viewBox[2] > 840, `viewBox ${viewBox.join(' ')} does not reach the offshore pin`);
  });

  test('selecting a municipality shows its structures as icon pins and preview cards', () => {
    const { container } = render();
    const barcelona = rtl.within(container.querySelector('aside') as HTMLElement).getByRole('button', { name: /Barcelona/ });
    rtl.fireEvent.click(barcelona);
    assert.equal(rtl.screen.getAllByLabelText(/Open details/).length, 3);
    const panel = rtl.within(container.querySelector('aside') as HTMLElement);
    assert.ok(panel.getByRole('button', { name: /St\. Joseph Church/ }));
    assert.equal(container.querySelectorAll('circle[aria-hidden="true"]').length, 0);
  });

  test('pins that share coordinates are drawn apart from each other', () => {
    const { container } = render();
    rtl.fireEvent.click(rtl.within(container.querySelector('aside') as HTMLElement).getByRole('button', { name: /Barcelona/ }));
    const pins = rtl.screen.getAllByLabelText(/Open details/);
    const centres = pins.map((pin) => {
      const circle = pin.querySelector('circle')!;
      return [Number(circle.getAttribute('cx')), Number(circle.getAttribute('cy'))];
    });
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        assert.ok(Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]) > 0.5, `pins ${i} and ${j} overlap`);
      }
    }
  });

  test('opening a pin shows the popup with details and a See more link, and Escape steps back out', () => {
    const { container } = render();
    rtl.fireEvent.click(rtl.within(container.querySelector('aside') as HTMLElement).getByRole('button', { name: /Barcelona/ }));
    rtl.fireEvent.click(rtl.screen.getByLabelText(/St\. Joseph Church, Church/));
    const dialog = rtl.screen.getByRole('dialog');
    assert.ok(rtl.within(dialog).getByText('St. Joseph Church'));
    assert.ok(rtl.within(dialog).getByText('Coral Rocks'));
    const link = rtl.within(dialog).getByRole('link', { name: 'See more' });
    assert.equal(link.getAttribute('href'), '/structures/barcelona-st-joseph');

    rtl.fireEvent.keyDown(document, { key: 'Escape' });
    assert.equal(rtl.screen.queryByRole('dialog'), null);
    assert.equal(rtl.screen.getAllByLabelText(/Open details/).length, 3);

    rtl.fireEvent.keyDown(document, { key: 'Escape' });
    assert.equal(rtl.screen.queryAllByLabelText(/Open details/).length, 0);
  });

  test('frames the municipality away from the popup while it is open, and back when it closes', () => {
    const { container } = render();
    const viewBox = () => container.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number);
    rtl.fireEvent.click(rtl.within(container.querySelector('aside') as HTMLElement).getByRole('button', { name: /Barcelona/ }));
    const before = viewBox();
    rtl.fireEvent.click(rtl.screen.getByLabelText(/St\. Joseph Church, Church/));
    const during = viewBox();
    assert.ok(during[0] < before[0], 'the view shifts so the popup does not sit on the pins');
    rtl.fireEvent.keyDown(document, { key: 'Escape' });
    assert.deepEqual(viewBox(), before);
  });

  test('a municipality with no structures says so instead of showing an empty list', () => {
    const { container } = render();
    rtl.fireEvent.click(rtl.within(container.querySelector('aside') as HTMLElement).getByRole('button', { name: /Matnog/ }));
    assert.ok(rtl.screen.getByText(/No structures are documented in this municipality/));
  });

  test('a structure without a photo still gets a preview card', () => {
    const { container } = render();
    rtl.fireEvent.click(rtl.within(container.querySelector('aside') as HTMLElement).getByRole('button', { name: /Barcelona/ }));
    const panel = rtl.within(container.querySelector('aside') as HTMLElement);
    assert.ok(panel.getByText('Escuela Pia Barcelona'));
    assert.ok(panel.getAllByText('No photo available').length >= 1);
  });

  test('opens straight to a structure when the page address names one', () => {
    dom.reconfigure({ url: 'http://localhost/map?s=barcelona-st-joseph' });
    const { container } = render();
    const dialog = rtl.screen.getByRole('dialog');
    assert.ok(rtl.within(dialog).getByText('St. Joseph Church'));
    assert.ok(container.querySelector('aside h2')!.textContent === 'Barcelona');
    dom.reconfigure({ url: 'http://localhost/' });
  });
});
