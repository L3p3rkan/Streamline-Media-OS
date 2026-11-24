import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, CircleHelp, LockKeyhole, Settings2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Link, Route, Switch, useLocation } from 'wouter';

type StreamingService = { id: string; name: string; url: string; category: string };
type KioskStatus = { helperAvailable: boolean; clearing: boolean; clearError?: string | null };

const services: StreamingService[] = [
  { id: 'netflix', name: 'Netflix', url: 'https://www.netflix.com/', category: 'Series & films' },
  { id: 'hulu', name: 'Hulu', url: 'https://www.hulu.com/', category: 'Series & films' },
  { id: 'plex', name: 'Plex', url: 'https://app.plex.tv/', category: 'Your library' },
  { id: 'paramount', name: 'Paramount+', url: 'https://www.paramountplus.com/', category: 'Series & films' },
  { id: 'disney', name: 'Disney+', url: 'https://www.disneyplus.com/', category: 'Family & films' },
  { id: 'prime', name: 'Prime Video', url: 'https://www.primevideo.com/', category: 'Series & films' },
  { id: 'max', name: 'Max', url: 'https://www.max.com/', category: 'Series & films' },
  { id: 'apple', name: 'Apple TV+', url: 'https://tv.apple.com/', category: 'Series & films' },
  { id: 'peacock', name: 'Peacock', url: 'https://www.peacocktv.com/', category: 'Series & films' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/', category: 'Video & live' },
  { id: 'fubo', name: 'Fubo', url: 'https://www.fubo.tv/', category: 'Live TV' },
  { id: 'sling-tv', name: 'Sling TV', url: 'https://www.sling.com/', category: 'Live TV' },
  { id: 'youtube-tv', name: 'YouTube TV', url: 'https://tv.youtube.com/', category: 'Live TV' },
  { id: 'sling-freestream', name: 'Sling Freestream', url: 'https://www.sling.com/freestream', category: 'Free streaming' },
  { id: 'tubi', name: 'Tubi', url: 'https://tubitv.com/', category: 'Free streaming' },
  { id: 'britbox', name: 'BritBox', url: 'https://www.britbox.com/', category: 'Series & films' },
  { id: 'amc-plus', name: 'AMC+', url: 'https://www.amcplus.com/', category: 'Series & films' },
  { id: 'discovery-plus', name: 'Discovery+', url: 'https://www.discoveryplus.com/', category: 'Documentaries' },
  { id: 'web-browser', name: 'Web Browser', url: 'https://www.google.com/', category: 'Browse the web' },
  { id: 'hallmark-plus', name: 'Hallmark+', url: 'https://www.hallmarkplus.com/', category: 'Series & films' },
  { id: 'espn-unlimited', name: 'ESPN Unlimited', url: 'https://www.espn.com/watch/', category: 'Sports' },
  { id: 'espn-select', name: 'ESPN Select', url: 'https://www.espn.com/watch/', category: 'Sports' },
  { id: 'fox-one', name: 'FOX One', url: 'https://www.fox.com/foxone/', category: 'Live TV' },
  { id: 'mlb-tv', name: 'MLB.TV', url: 'https://www.mlb.com/tv', category: 'Sports' },
  { id: 'mlb-plus', name: 'MLB+', url: 'https://www.mlb.com/plus', category: 'Sports' },
  { id: 'angel-studios', name: 'Angel Studios', url: 'https://www.angel.com/', category: 'Films & series' },
  { id: 'great-american-pure-flix', name: 'Great American Pure Flix', url: 'https://www.pureflix.com/', category: 'Films & series' },
];

const serviceMarks: Record<string, string> = {
  netflix: 'N', hulu: 'h', plex: 'P', paramount: 'P+', disney: 'D+', prime: 'prime', max: 'M',
  apple: 'tv+', peacock: 'P', youtube: '▶',
  fubo: 'F', 'sling-tv': 'S', 'youtube-tv': 'YT', 'sling-freestream': 'SF', tubi: 'T',
  britbox: 'B', 'amc-plus': 'AMC', 'discovery-plus': 'D+', 'web-browser': '↗',
  'hallmark-plus': 'H+', 'espn-unlimited': 'U', 'espn-select': 'S', 'fox-one': 'FOX',
  'mlb-tv': 'MLB', 'mlb-plus': 'MLB+', 'angel-studios': 'A', 'great-american-pure-flix': 'GA',
};
const serviceLogos: Record<string, string> = {
  netflix: '/brand-logos/netflix.png',
  hulu: '/brand-logos/hulu.png',
  plex: '/brand-logos/plex.ico',
  paramount: '/brand-logos/paramount.ico',
  disney: '/brand-logos/disney.svg',
  prime: '/brand-logos/prime.png',
  max: '/brand-logos/max.png',
  apple: '/brand-logos/apple.png',
  peacock: '/brand-logos/peacock.png',
  youtube: '/brand-logos/youtube.png',
  fubo: '/brand-logos/fubo.png',
  'sling-tv': '/brand-logos/sling-tv.ico',
  'youtube-tv': '/brand-logos/youtube-tv.png',
  'sling-freestream': '/brand-logos/sling-freestream.ico',
  tubi: '/brand-logos/tubi.png',
  britbox: '/brand-logos/britbox.png',
  'amc-plus': '/brand-logos/amc-plus.png',
  'discovery-plus': '/brand-logos/discovery-plus.png',
  'web-browser': '/brand-logos/web-browser.png',
  'hallmark-plus': '/brand-logos/hallmark-plus.png',
  'espn-unlimited': '/brand-logos/espn-unlimited.ico',
  'espn-select': '/brand-logos/espn-select.ico',
  'fox-one': '/brand-logos/fox-one.png',
  'mlb-tv': '/brand-logos/mlb-tv.png',
  'mlb-plus': '/brand-logos/mlb-plus.png',
  'angel-studios': '/brand-logos/angel-studios.png',
  'great-american-pure-flix': '/brand-logos/great-american-pure-flix.png',
};
const serviceColors: Record<string, string> = Object.fromEntries(
  services.map(({ id }) => [id, '#3CB4E5']),
);

const SERVICE_ORDER_KEY = 'streamline-service-order';
const defaultServiceOrder = services.map((service) => service.id);

function readServiceOrder() {
  try {
    const saved = window.localStorage.getItem(SERVICE_ORDER_KEY);
    if (!saved) return defaultServiceOrder;
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) return defaultServiceOrder;
    const available = new Set(defaultServiceOrder);
    const validSavedIds = [...new Set(parsed.filter((id: string) => available.has(id)))];
    return [...validSavedIds, ...defaultServiceOrder.filter((id) => !validSavedIds.includes(id))];
  } catch {
    return defaultServiceOrder;
  }
}

const KIOSK_ORIGIN = 'http://127.0.0.1:8765';

function isKioskOrigin() {
  return window.location.origin === KIOSK_ORIGIN;
}

function useRemoteNavigation() {
  const [location, setLocation] = useLocation();
  useEffect(() => {
    if (location !== '/') return;
    const timer = window.setTimeout(() => document.querySelector<HTMLElement>('[data-service-card]')?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [location]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const active = document.activeElement as HTMLElement | null;
      const dialogOpen = Boolean(document.querySelector('[role="dialog"]'));
      if (dialogOpen && event.key === 'Escape') return;
      if (event.key === 'Escape' || event.key === 'BrowserBack' || (event.key === 'Backspace' && !['INPUT', 'TEXTAREA'].includes(active?.tagName ?? ''))) {
        if (window.location.pathname !== '/') {
          event.preventDefault();
          setLocation('/');
        }
        return;
      }
      if (event.key === 'Home' && !dialogOpen) {
        event.preventDefault();
        setLocation('/');
        window.setTimeout(() => document.querySelector<HTMLElement>('[data-service-card]')?.focus(), 50);
        return;
      }
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const navigationScope = dialogOpen
        ? document.querySelector<HTMLElement>('[role="dialog"]')
        : document;
      const candidates = Array.from(navigationScope?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [])
        .filter((element) => element.getClientRects().length > 0 && !element.hasAttribute('aria-hidden'));
      if (!candidates.length) return;
      if (!active || !candidates.includes(active)) {
        event.preventDefault();
        candidates[0]?.focus();
        return;
      }
      const current = active.getBoundingClientRect();
      const cx = current.left + current.width / 2;
      const cy = current.top + current.height / 2;
      const direction = event.key.slice(5).toLowerCase();
      const possible = candidates.filter((element) => element !== active).map((element) => {
        const rect = element.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - cx;
        const dy = rect.top + rect.height / 2 - cy;
        const forward = direction === 'right' ? dx > 3 : direction === 'left' ? dx < -3 : direction === 'down' ? dy > 3 : dy < -3;
        const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
        const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
        return { element, forward, score: primary + secondary * 2.3 };
      }).filter((item) => item.forward).sort((a, b) => a.score - b.score);
      if (possible.length) {
        event.preventDefault();
        possible[0].element.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [setLocation]);
}

function Header() {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Streamline home" data-testid="link-streamline-home">
        <span className="brand-mark" aria-hidden="true"><span>↗</span></span>
        <span className="brand-name">stream<span>line</span></span>
      </Link>
      <div className="top-actions">
        <span className="system-note">Personal media PC</span>
        <Link href="/settings" className="settings-link" data-testid="link-settings">
          <Settings2 size={16} strokeWidth={1.8} /> Settings
        </Link>
      </div>
    </header>
  );
}

function ServiceCard({ service, index }: { service: StreamingService; index: number }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const openInNewTab = !isKioskOrigin();
  return (
    <a
      className={`service-card reveal ${index > 3 ? 'delay-1' : ''}`}
      style={{ '--service': serviceColors[service.id] } as CSSProperties}
      href={service.url}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      data-service-card
      data-testid={`link-service-${service.id}`}
      aria-label={`Open ${service.name} ${openInNewTab ? 'in a new tab' : 'in this browser'}`}
    >
      <span className="service-top">
        <span className="service-icon" aria-hidden="true">
          {logoFailed
            ? serviceMarks[service.id]
            : <img className="service-logo" src={serviceLogos[service.id]} alt="" onError={() => setLogoFailed(true)} />}
        </span>
        <span className="service-category">{service.category}</span>
      </span>
      <span className="service-bottom">
        <span className="service-name">{service.name}</span>
        <span className="launch-arrow" aria-hidden="true"><ArrowUpRight size={16} /></span>
      </span>
    </a>
  );
}

function Home({ orderedServices }: { orderedServices: StreamingService[] }) {
  return (
    <div className="app-shell">
      <Header />
      <main className="home-content">
        <div className="eyebrow reveal">Your screen, your choice</div>
        <div className="hero-row reveal delay-1">
          <h1 className="hero-title">A little less<br /><em>searching.</em> More watching.</h1>
          <div className="hero-aside">
            Pick a service to open its <strong>official website</strong> in this browser. Sign in there, and Firefox can remember it for next time.
          </div>
        </div>
        <section aria-labelledby="services-title" className="reveal delay-2">
          <div className="section-heading">
            <h2 id="services-title">Streaming &amp; web</h2>
            <span>Choose a destination <ArrowUpRight size={12} aria-hidden="true" /></span>
          </div>
          <div className="service-grid">
            {orderedServices.map((service, index) => <ServiceCard key={service.id} service={service} index={index} />)}
          </div>
        </section>
        <footer className="bottom-row">
          <span className="security-note" data-testid="text-password-safety"><ShieldCheck size={15} /> Sign-ins stay in Firefox Password Manager. Streamline never asks for them.</span>
          <span className="key-hint">Use arrow keys to move · Enter to open</span>
        </footer>
      </main>
    </div>
  );
}

function ClearConfirmDialog({ onCancel, onConfirm, busy }: { onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  useEffect(() => {
    const first = document.querySelector<HTMLElement>('[data-confirm-cancel]');
    first?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-copy" data-testid="dialog-clear-login">
        <div className="panel-overline">Firefox kiosk profile</div>
        <h2 id="confirm-title">Clear saved login data?</h2>
        <p id="confirm-copy">This will erase the Firefox kiosk profile, including all saved passwords and cookies. You’ll need to sign in to streaming services again. This cannot be undone.</p>
        <div className="dialog-actions">
          <button type="button" className="cancel-button" data-confirm-cancel onClick={onCancel} disabled={busy}>Keep my data</button>
          <button type="button" className="confirm-clear" data-testid="button-confirm-clear" onClick={onConfirm} disabled={busy}>
            {busy ? 'Clearing profile…' : 'Erase profile'}
          </button>
        </div>
      </section>
    </div>
  );
}

function Settings({
  orderedServices,
  onMoveService,
  orderMessage,
}: {
  orderedServices: StreamingService[];
  onMoveService: (serviceId: string, offset: number) => void;
  orderMessage: string;
}) {
  const [status, setStatus] = useState<KioskStatus>({ helperAvailable: false, clearing: false });
  const [checkingHelper, setCheckingHelper] = useState(isKioskOrigin());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState('');
  const kiosk = isKioskOrigin();

  useEffect(() => {
    if (!kiosk) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('loginDataCleared') === '1') {
      setMessage('Saved passwords and site data were removed. Sign in again on each service as needed.');
    }
    const controller = new AbortController();
    fetch('/api/kiosk-status', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Kiosk helper unavailable');
        const result = await response.json() as { helperAvailable?: boolean; clearInProgress?: boolean; clearError?: string | null };
        setStatus({
          helperAvailable: result.helperAvailable === true,
          clearing: result.clearInProgress === true,
          clearError: result.clearError ?? null,
        });
        if (result.clearError) {
          setMessage('Firefox could not clear the saved login profile. Your existing sign-ins may still be present.');
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus((current) => ({ ...current, helperAvailable: false }));
      })
      .finally(() => setCheckingHelper(false));
    return () => controller.abort();
  }, [kiosk]);

  const clearLogin = async () => {
    setStatus((current) => ({ ...current, clearing: true }));
    setMessage('');
    try {
      const response = await fetch('/api/clear-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        setStatus({ helperAvailable: false, clearing: false });
        setConfirmOpen(false);
        setMessage('The local kiosk helper did not confirm the request. No success is being reported; login data may still be present.');
        return;
      }
      setStatus({ helperAvailable: true, clearing: false });
      setConfirmOpen(false);
      setMessage('Firefox is restarting with a clean profile. Sign in again on each service as needed.');
    } catch {
      setStatus({ helperAvailable: false, clearing: false });
      setConfirmOpen(false);
      setMessage('Could not reach the local kiosk helper. No success is being reported; login data may still be present.');
    }
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="settings-content">
        <Link href="/" className="eyebrow" data-testid="link-back-dashboard"><ArrowLeft size={14} /> Dashboard</Link>
        <div className="settings-heading reveal">
          <h1>Settings</h1>
          <p>Manage this kiosk’s browser profile. Your streaming accounts remain between you and the official service websites.</p>
        </div>
        <div className="settings-layout">
          <section className="settings-panel reveal delay-1" aria-labelledby="browser-title">
            <div className="panel-overline">How sign-in works</div>
            <h2 id="browser-title">Firefox keeps the keys</h2>
            <p>Streamline only opens services. It never asks for, collects, or stores usernames or passwords.</p>
            <div className="profile-state">
              <span className="state-dot" aria-hidden="true" />
              <span className="state-copy"><strong>Private to this browser profile</strong><span>Firefox may offer to save your sign-in after you log in on a service’s official site.</span></span>
            </div>
            <ol className="steps">
              <li>Choose a service on the dashboard to open its official website here.</li>
              <li>Enter your sign-in directly on that service’s site.</li>
              <li>Use Firefox’s save-password prompt if you want this kiosk to remember it.</li>
            </ol>
          </section>
          <section className="settings-panel clear-panel reveal delay-2" aria-labelledby="clear-title">
            <div className="panel-overline">Kiosk maintenance</div>
            <h2 id="clear-title">Clear saved logins</h2>
            <p>This removes the kiosk’s Firefox profile, not just one service. Saved passwords, cookies, and other profile data are erased together.</p>
            {!kiosk || checkingHelper || !status.helperAvailable ? (
              <div className="unavailable" role="status" data-testid="status-helper-unavailable">
                <CircleHelp size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {!kiosk
                  ? 'Login data can only be cleared from the local Linux kiosk, not from this hosted preview.'
                  : checkingHelper
                    ? 'Checking the local kiosk profile…'
                    : 'The local kiosk helper is unavailable. Login data cannot be cleared from this page.'}
              </div>
            ) : (
              <button className="clear-button" type="button" data-testid="button-clear-login" onClick={() => setConfirmOpen(true)} disabled={status.clearing}>
                <LockKeyhole size={15} /> Clear login data
              </button>
            )}
            {message && <div className="inline-status" role="status" data-testid="status-clear-result">{message}</div>}
            <div className="warning-box"><TriangleAlert size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Clearing affects every saved sign-in in the kiosk profile. Streamline does not store a separate copy.</div>
          </section>
        </div>
        <section className="settings-panel service-order-panel reveal delay-2" aria-labelledby="order-title">
          <div className="panel-overline">Personalize</div>
          <h2 id="order-title">Arrange apps</h2>
          <p>Move your favorite services toward the top. Your order is saved on this device.</p>
          {orderMessage && <div className="inline-status" role="status">{orderMessage}</div>}
          <ol className="service-order-list">
            {orderedServices.map((service, index) => (
              <li className="service-order-row" key={service.id}>
                <span className="service-order-position">{String(index + 1).padStart(2, '0')}</span>
                <span className="service-order-name">{service.name}</span>
                <span className="service-order-actions">
                  <button
                    type="button"
                    className="order-button"
                    aria-label={`Move ${service.name} up`}
                    title={`Move ${service.name} up`}
                    disabled={index === 0}
                    onClick={() => onMoveService(service.id, -1)}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="order-button"
                    aria-label={`Move ${service.name} down`}
                    title={`Move ${service.name} down`}
                    disabled={index === orderedServices.length - 1}
                    onClick={() => onMoveService(service.id, 1)}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
      {confirmOpen && <ClearConfirmDialog onCancel={() => setConfirmOpen(false)} onConfirm={clearLogin} busy={status.clearing} />}
    </div>
  );
}

function NotFound() {
  return <main className="not-found app-shell"><div><div className="eyebrow">Wrong turn</div><h1>That page isn’t here.</h1><p>Head back to your streaming services.</p><Link href="/" data-testid="link-not-found-home">Return to dashboard</Link></div></main>;
}

function App() {
  useRemoteNavigation();
  const [serviceOrder, setServiceOrder] = useState(readServiceOrder);
  const [orderMessage, setOrderMessage] = useState('');
  const orderedServices = serviceOrder
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is StreamingService => service !== undefined);

  const moveService = (serviceId: string, offset: number) => {
    const currentIndex = serviceOrder.indexOf(serviceId);
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= serviceOrder.length) return;
    const nextOrder = [...serviceOrder];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    setServiceOrder(nextOrder);
    try {
      window.localStorage.setItem(SERVICE_ORDER_KEY, JSON.stringify(nextOrder));
      setOrderMessage('Your app order is saved on this device.');
    } catch {
      setOrderMessage('Your order changed for this session, but could not be saved on this device.');
    }
  };

  return (
    <Switch>
      <Route path="/"><Home orderedServices={orderedServices} /></Route>
      <Route path="/settings">
        <Settings orderedServices={orderedServices} onMoveService={moveService} orderMessage={orderMessage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default App;
