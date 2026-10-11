import { Copy, FilePlus, Pencil, Plus, RotateCcw, Trash } from 'lucide-react';
import { TRADE_LABELS } from '../../data/regions';
import type { QuoteTemplate } from '../../domain/types';
import { navigate, paths } from '../../state/router';
import { useStore } from '../../state/store';
import { Button, LinkButton } from '../../ui/Button';
import { useFeedback } from '../../ui/feedback';
import { Badge, PageHeader } from '../../ui/layout';
import { PresetsEditor } from './PresetsEditor';

const KIND_LABEL: Record<QuoteTemplate['kind'], string> = {
  standard: 'Standard service',
  detailed: 'Detailed project',
  premium: 'Premium package',
  custom: 'Custom',
};

export function TemplatesPage({ tab }: { tab: 'templates' | 'presets' }) {
  return (
    <div className="page">
      <PageHeader
        title="Templates"
        subtitle="Reusable starting points. Creating a quote copies the template, so later edits never change existing quotes."
      />
      <nav className="tabs" aria-label="Template sections">
        <a href={paths.templates} className={`tab ${tab === 'templates' ? 'is-active' : ''}`} aria-current={tab === 'templates' ? 'page' : undefined}>
          Quote templates
        </a>
        <a href={paths.presets} className={`tab ${tab === 'presets' ? 'is-active' : ''}`} aria-current={tab === 'presets' ? 'page' : undefined}>
          Trade presets & item library
        </a>
      </nav>
      {tab === 'templates' ? <TemplateList /> : <PresetsEditor />}
    </div>
  );
}

function TemplateList() {
  const { state, actions } = useStore();
  const { toast, confirm } = useFeedback();

  const use = (t: QuoteTemplate) => {
    const id = actions.newQuoteFromTemplate(t.id);
    if (id) {
      navigate(paths.quote(id));
      toast({ message: `New quote created from “${t.name}”.`, tone: 'success' });
    }
  };

  const remove = async (t: QuoteTemplate) => {
    const ok = await confirm({
      title: 'Delete this template?',
      message: `“${t.name}” will be removed. Quotes already created from it are not affected.`,
      confirmLabel: 'Delete template',
      tone: 'danger',
    });
    if (!ok) return;
    actions.deleteTemplate(t.id);
    toast({ message: 'Template deleted.', tone: 'info' });
  };

  const resetStarters = async () => {
    const ok = await confirm({
      title: 'Reset starter templates?',
      message: 'The three starter templates go back to their original content. Your own templates and existing quotes are not changed.',
      confirmLabel: 'Reset starters',
    });
    if (!ok) return;
    actions.resetStarterTemplates();
    toast({ message: 'Starter templates restored.', tone: 'success' });
  };

  return (
    <>
      <div className="toolbar">
        <Button variant="primary" icon={Plus} onClick={() => navigate(paths.template(actions.newTemplate(state.business.tradeType)))}>
          New template
        </Button>
        <Button variant="ghost" icon={RotateCcw} onClick={resetStarters}>
          Reset starter templates
        </Button>
      </div>
      <ul className="template-grid">
        {state.templates.map((t) => {
          const included = t.lineItems.filter((l) => l.visibility === 'included').length;
          const optional = t.lineItems.filter((l) => l.visibility === 'optional').length;
          return (
            <li key={t.id} className={`template-card template-card--${t.kind}`}>
              <div className="template-card__top">
                <Badge tone={t.kind === 'custom' ? 'neutral' : 'green'}>{KIND_LABEL[t.kind]}</Badge>
                {t.isStarter && <span className="muted small">Starter</span>}
              </div>
              <h2 className="template-card__name">{t.name || 'Untitled template'}</h2>
              <p className="template-card__desc">{t.description || 'No description.'}</p>
              <p className="muted small">
                {TRADE_LABELS[t.tradeType]} · {included} item{included === 1 ? '' : 's'}
                {optional > 0 && ` + ${optional} optional`}
                {t.deposit && t.deposit.type !== 'none' && ` · ${t.deposit.type === 'percent' ? `${t.deposit.value}% deposit` : 'fixed deposit'}`}
              </p>
              <div className="template-card__actions">
                <Button variant="primary" size="sm" icon={FilePlus} onClick={() => use(t)}>
                  Use template
                </Button>
                <LinkButton href={paths.template(t.id)} size="sm" icon={Pencil}>
                  Edit
                </LinkButton>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={Copy}
                  onClick={() => {
                    actions.duplicateTemplate(t.id);
                    toast({ message: `Duplicated “${t.name}”.`, tone: 'success' });
                  }}
                >
                  Duplicate {t.name}
                </Button>
                {!t.isStarter && (
                  <Button size="sm" variant="ghost" iconOnly icon={Trash} className="btn--danger-ghost" onClick={() => remove(t)}>
                    Delete {t.name}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
