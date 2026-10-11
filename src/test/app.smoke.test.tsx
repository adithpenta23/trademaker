/**
 * End-to-end style smoke test of the real app in jsdom: first run, creating a
 * quote, editing line items, checking displayed totals, navigation, print and
 * JSON export. (No browser-automation framework is used in this project.)
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { parseBackupText } from '../io/backup';

function setup() {
  window.location.hash = '';
  const user = userEvent.setup();
  const utils = render(<App />);
  return { user, ...utils };
}

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('TradeMaker app', { timeout: 30_000 }, () => {
  let downloads: { name: string; blob: Blob }[];
  const realCreate = URL.createObjectURL;

  beforeEach(() => {
    downloads = [];
    const blobs = new Map<string, Blob>();
    URL.createObjectURL = vi.fn((blob: Blob) => {
      const url = `blob:test/${blobs.size}`;
      blobs.set(url, blob);
      return url;
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      const blob = blobs.get(this.href);
      if (blob) downloads.push({ name: this.download, blob });
    });
  });

  afterEach(() => {
    URL.createObjectURL = realCreate;
    vi.restoreAllMocks();
  });

  it('runs the first-run flow, builds a quote and shows correct totals', async () => {
    const { user } = setup();

    // First run: welcome panel, skip straight to the calculator.
    expect(screen.getByRole('dialog', { name: /quote confidently/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(screen.queryByRole('dialog', { name: /quote confidently/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /welcome to trademaker/i })).toBeInTheDocument();

    // Create a quote from the dashboard.
    await user.click(screen.getAllByRole('button', { name: /create new quote/i })[0]!);
    expect(screen.getByRole('heading', { level: 1, name: /Q-1001/ })).toBeInTheDocument();

    // Fill the first line: 2 × $150 with $40 of materials.
    await user.type(screen.getByRole('textbox', { name: /item 1 name/i }), 'Driveway cleaning');
    const qty = screen.getAllByRole('textbox', { name: /^qty$/i })[0]!;
    await user.clear(qty);
    await user.type(qty, '2');
    const price = screen.getAllByRole('textbox', { name: /^unit price$/i })[0]!;
    await user.clear(price);
    await user.type(price, '150');
    await user.click(screen.getByRole('button', { name: /options & internal costs/i }));
    const materials = screen.getByRole('textbox', { name: /^materials$/i });
    await user.clear(materials);
    await user.type(materials, '40');

    // Add a second line: 1 × $75.50.
    await user.click(screen.getByRole('button', { name: /^add item$/i }));
    await user.type(screen.getByRole('textbox', { name: /item 2 name/i }), 'Path cleaning');
    const price2 = screen.getAllByRole('textbox', { name: /^unit price$/i })[1]!;
    await user.clear(price2);
    await user.type(price2, '75.50');

    // Profit panel: total 375.50, cost 40, profit 335.50.
    const panel = screen.getByRole('region', { name: /job profitability/i });
    expect(within(panel).getAllByText('$375.50').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('$335.50').length).toBeGreaterThan(0);

    // The customer preview shows the same total and never the internal cost.
    const preview = screen.getByRole('article', { name: /quote preview/i });
    expect(within(preview).getByText('Total').closest('div')).toHaveTextContent('$375.50');
    expect(within(preview).getByText('Driveway cleaning')).toBeInTheDocument();
    expect(within(preview).queryByText(/\$40\.00/)).not.toBeInTheDocument();
    expect(within(preview).queryByText(/profit|margin/i)).not.toBeInTheDocument();

    // Reorder: move line 2 up.
    await user.click(screen.getByRole('button', { name: /move path cleaning up/i }));
    expect((screen.getAllByRole('textbox', { name: /item 1 name/i })[0] as HTMLInputElement).value).toBe('Path cleaning');

    // Print uses the browser print dialog with the customer document.
    // Like a desktop browser, print() blocks and fires "afterprint" before returning (jsdom has no print).
    const print = vi.fn(() => {
      expect(document.getElementById('print-root')).toHaveTextContent('Driveway cleaning');
      expect(document.getElementById('print-root')).not.toHaveTextContent('Estimated profit');
      window.dispatchEvent(new Event('afterprint'));
    });
    window.print = print;
    await user.click(screen.getAllByRole('button', { name: /^print$/i })[0]!);
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.getElementById('print-root')).not.toBeInTheDocument();

    // Export the quote as JSON and import-validate it.
    await user.click(screen.getByRole('button', { name: /more quote actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /export quote/i }));
    expect(downloads).toHaveLength(1);
    const parsed = parseBackupText(await downloads[0]!.blob.text());
    expect(parsed.ok && parsed.file.data.quotes[0]?.lineItems.map((l) => l.name)).toEqual(['Path cleaning', 'Driveway cleaning']);
  });

  it('navigates every section and loads the demo', async () => {
    const { user } = setup();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /load demo/i }));
    expect(screen.getByRole('heading', { level: 1, name: /evergreen exterior care/i })).toBeInTheDocument();
    expect(screen.getAllByText(/sample data/i).length).toBeGreaterThan(0);

    const pages: [string, RegExp][] = [
      ['#/quotes', /^quotes$/i],
      ['#/templates', /^templates$/i],
      ['#/templates/presets', /^templates$/i],
      ['#/business', /business profile/i],
      ['#/pricing', /pricing settings/i],
      ['#/data', /data & backup/i],
      ['#/', /evergreen exterior care/i],
    ];
    for (const [hash, heading] of pages) {
      await go(hash);
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    }

    // Quotes list: 6 demo quotes, searchable.
    await go('#/quotes');
    expect(screen.getByText(/showing 6 of 6 quotes/i)).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'deck');
    expect(screen.getByText(/showing 1 of 6 quotes/i)).toBeInTheDocument();

    // Full backup export works from the Data page.
    await go('#/data');
    await user.click(screen.getByRole('button', { name: /export complete backup/i }));
    const backup = parseBackupText(await downloads.at(-1)!.blob.text());
    expect(backup.ok && backup.summary).toMatchObject({ kind: 'full', quoteCount: 6 });
  });

  it('restores a session from an exported backup and rejects bad files', async () => {
    const { user, container } = setup();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /load demo/i }));
    await go('#/data');
    await user.click(screen.getByRole('button', { name: /export complete backup/i }));
    const backupText = await downloads.at(-1)!.blob.text();

    // Clear the session (confirmation required), then skip the welcome panel.
    await user.click(screen.getByRole('button', { name: /^clear session$/i }));
    await user.click(within(screen.getByRole('dialog', { name: /clear the whole session/i })).getByRole('button', { name: /clear session/i }));
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    await go('#/quotes');
    expect(screen.getByText(/no quotes in this session yet/i)).toBeInTheDocument();

    // A malformed file is rejected with a readable error.
    await go('#/data');
    const fileInput = () => container.querySelector<HTMLInputElement>('input[type="file"][accept*="json"]')!;
    await user.upload(fileInput(), new File(['{ nope'], 'broken.json', { type: 'application/json' }));
    expect(await screen.findByText(/isn't valid JSON/i)).toBeInTheDocument();

    // The real backup imports after an explicit replace confirmation.
    await user.upload(fileInput(), new File([backupText], 'backup.json', { type: 'application/json' }));
    expect(await screen.findByText(/ready to import/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^replace session$/i }));
    await user.click(within(screen.getByRole('dialog', { name: /replace the current session/i })).getByRole('button', { name: /replace session/i }));
    expect(await screen.findByText(/showing 6 of 6 quotes/i)).toBeInTheDocument();
  });
});
