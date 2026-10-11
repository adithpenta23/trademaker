import { Download, FileBraces, ShieldCheck, Sparkles, Trash, Upload } from 'lucide-react';
import { useState } from 'react';
import { MAX_IMPORT_BYTES, mergeIntoSession, parseBackupText, replaceSessionWith, type ImportResult } from '../../io/backup';
import { readFileAsText } from '../../io/files';
import { navigate, paths } from '../../state/router';
import { useStore } from '../../state/store';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/feedback';
import { Segmented, SelectField } from '../../ui/fields';
import { Callout, Card, PageHeader } from '../../ui/layout';
import { useQuoteExport } from '../document/useQuoteExport';
import { useSessionActions } from '../useSessionActions';

export function DataBackupPage() {
  const { state } = useStore();
  const { exportBackup, loadDemo, clearSession } = useSessionActions();
  const { exportQuoteJson } = useQuoteExport();
  const [quoteId, setQuoteId] = useState(state.quotes[0]?.id ?? '');
  const selected = state.quotes.find((q) => q.id === quoteId) ?? state.quotes[0];

  return (
    <div className="page page--narrow">
      <PageHeader title="Data & backup" subtitle="You decide when data leaves or enters TradeMaker. Nothing is uploaded or stored automatically." />

      <Callout tone={state.changedSinceExport ? 'warning' : 'info'} title="How your data is kept">
        <p>
          Your business profile, settings, templates and quotes exist only in this browser tab's memory. There is no account, server, cookie or browser
          storage. Refreshing, closing the tab or restarting the browser clears everything.
        </p>
        <p>
          To keep your work, export a backup file and import it next time.{' '}
          {state.lastExportAt
            ? `Last full backup: ${new Date(state.lastExportAt).toLocaleString(state.business.locale)}${state.changedSinceExport ? ' (changes since then are not in it).' : '.'}`
            : 'You have not exported a backup in this session.'}
        </p>
      </Callout>

      <Card title="Export" icon={<Download size={18} aria-hidden />}>
        <div className="export-options">
          <div className="export-option">
            <div>
              <h3>Complete backup</h3>
              <p className="muted small">Business profile, pricing settings, trade presets, templates and all {state.quotes.length} quotes.</p>
            </div>
            <Button variant="primary" icon={Download} onClick={() => exportBackup('full')}>
              Export complete backup
            </Button>
          </div>
          <div className="export-option">
            <div>
              <h3>Quotes and templates</h3>
              <p className="muted small">All quotes and templates, without your business profile or settings.</p>
            </div>
            <Button icon={FileBraces} onClick={() => exportBackup('quotes')} disabled={state.quotes.length === 0 && state.templates.length === 0}>
              Export quotes & templates
            </Button>
          </div>
          <div className="export-option">
            <div>
              <h3>A single quote</h3>
              {state.quotes.length > 0 ? (
                <SelectField
                  label="Quote to export"
                  value={selected?.id ?? ''}
                  onChange={setQuoteId}
                  options={state.quotes.map((q) => ({ value: q.id, label: `${q.number || 'No number'} — ${q.title || 'Untitled'}` }))}
                />
              ) : (
                <p className="muted small">No quotes in this session yet.</p>
              )}
            </div>
            <Button icon={FileBraces} disabled={!selected} onClick={() => selected && exportQuoteJson(selected)}>
              Export quote
            </Button>
          </div>
        </div>
        <p className="muted small">
          Backups are plain JSON files with a schema version. They can contain customer names and addresses — store them as carefully as any customer
          record.
        </p>
      </Card>

      <ImportCard />

      <Card title="Sample data & reset" icon={<Sparkles size={18} aria-hidden />}>
        <p className="muted small">
          The demo loads “Evergreen Exterior Care”, a fictional business with sample quotes. Its figures are invented and are not real business results.
        </p>
        <div className="button-row">
          <Button icon={Sparkles} onClick={loadDemo}>
            {state.isSampleSession ? 'Reset demo data' : 'Load demo data'}
          </Button>
          <Button variant="ghost" icon={Trash} className="btn--danger-ghost" onClick={clearSession}>
            Clear session
          </Button>
        </div>
      </Card>

      <p className="privacy-note">
        <ShieldCheck size={16} aria-hidden /> Files you import are read inside your browser and validated before use. Nothing in them is executed, and
        nothing is sent to a server.
      </p>
    </div>
  );
}

function ImportCard() {
  const { state, actions } = useStore();
  const { toast, confirm } = useFeedback();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [reading, setReading] = useState(false);

  const onFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setResult({ ok: false, error: `This file is too large to import (limit ${MAX_IMPORT_BYTES / 1024 / 1024} MB).` });
      return;
    }
    setReading(true);
    try {
      const text = await readFileAsText(file);
      const parsed = parseBackupText(text);
      setResult(parsed);
      if (parsed.ok) setMode(parsed.summary.kind === 'full' ? 'replace' : 'merge');
    } catch {
      setResult({ ok: false, error: "The file couldn't be read." });
    } finally {
      setReading(false);
    }
  };

  const apply = async () => {
    if (!result?.ok) return;
    const { file, summary } = result;
    if (mode === 'replace') {
      const replaces = [summary.hasSettings ? 'business profile and settings' : null, 'quotes', file.data.templates ? 'templates' : null]
        .filter(Boolean)
        .join(', ');
      const ok = await confirm({
        title: 'Replace the current session?',
        message: `Importing will replace this session's ${replaces} with the contents of “${fileName}”. Anything not exported will be lost.`,
        confirmLabel: 'Replace session',
        tone: 'danger',
      });
      if (!ok) return;
      actions.replaceSession(replaceSessionWith(state, file));
      toast({ message: `Imported ${summary.quoteCount} quote${summary.quoteCount === 1 ? '' : 's'}.`, tone: 'success' });
    } else {
      const merged = mergeIntoSession(state, file);
      actions.mergeSession(merged.quotes, merged.templates);
      const notes = [
        `Added ${merged.quotes.length} quote${merged.quotes.length === 1 ? '' : 's'} and ${merged.templates.length} template${merged.templates.length === 1 ? '' : 's'}.`,
        merged.skippedDuplicates > 0 ? `${merged.skippedDuplicates} identical item${merged.skippedDuplicates === 1 ? ' was' : 's were'} already here.` : '',
        merged.renumberedIds > 0 ? `${merged.renumberedIds} given new internal IDs to avoid clashes.` : '',
        merged.duplicateQuoteNumbers > 0 ? `${merged.duplicateQuoteNumbers} share a quote number with an existing quote — rename if needed.` : '',
      ];
      toast({ message: notes.filter(Boolean).join(' '), tone: 'success', duration: 8000 });
    }
    setResult(null);
    setFileName('');
    navigate(paths.quotes);
  };

  return (
    <Card title="Import a backup" icon={<Upload size={18} aria-hidden />}>
      <div className="import-drop">
        <label className={`btn btn--secondary file-btn ${reading ? 'is-disabled' : ''}`}>
          <Upload size={17} aria-hidden />
          Choose backup file…
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            disabled={reading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onFile(f);
            }}
          />
        </label>
        <span className="muted small">{reading ? 'Reading…' : fileName || `A .json file exported from TradeMaker, up to ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`}</span>
      </div>

      {result && !result.ok && (
        <Callout tone="danger" title="This file can't be imported">
          {result.error}
        </Callout>
      )}

      {result?.ok && (
        <div className="import-summary">
          <h3 className="subhead subhead--first">Ready to import</h3>
          <dl className="kv">
            <div>
              <dt>Backup type</dt>
              <dd>{result.summary.kind === 'full' ? 'Complete backup' : result.summary.kind === 'quotes' ? 'Quotes and templates' : 'Single quote'}</dd>
            </div>
            <div>
              <dt>Exported</dt>
              <dd>{new Date(result.summary.exportedAt).toLocaleString(state.business.locale)}</dd>
            </div>
            {result.summary.businessName && (
              <div>
                <dt>Business</dt>
                <dd>
                  {result.summary.businessName}
                  {result.summary.isSampleSession && ' (sample data)'}
                </dd>
              </div>
            )}
            <div>
              <dt>Contents</dt>
              <dd>
                {result.summary.quoteCount} quote{result.summary.quoteCount === 1 ? '' : 's'}
                {result.file.data.templates ? `, ${result.summary.templateCount} template${result.summary.templateCount === 1 ? '' : 's'}` : ''}
                {result.summary.hasSettings ? ', business profile and settings' : ''}
              </dd>
            </div>
          </dl>
          <Segmented
            label="How should it be imported?"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'replace', label: 'Replace this session' },
              { value: 'merge', label: 'Add to this session' },
            ]}
          />
          <p className="calc-note">
            {mode === 'replace'
              ? `Replaces the current ${result.summary.hasSettings ? 'business profile, settings, ' : ''}quotes${result.file.data.templates ? ' and templates' : ''} with the file's contents.`
              : 'Adds the quotes and templates to what you have now. Your business profile and settings stay as they are. Identical items are skipped; clashing IDs get new ones.'}
          </p>
          <div className="button-row">
            <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={apply}>
              {mode === 'replace' ? 'Replace session' : 'Add to session'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setResult(null);
                setFileName('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
