import {
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  FileJson,
  Info,
  Landmark,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  WalletCards,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPrices, mergeQuotes, resolveBistStock, searchTefasFunds, searchUsEtfs, searchUsStocks, type FundSearchItem, type UsSecuritySearchItem } from "./api";
import { isValidBistSymbol, normalizeBistSymbol, yahooBistSymbol } from "./bist";
import {
  SAMPLE_POSITIONS,
  TYPE_META,
  catalogFor,
  displaySymbol
} from "./catalog";
import { ACCOUNT_KIND_LABELS, ACCOUNT_KINDS, ACCOUNT_SUGGESTIONS, loadAccounts, mergeAccountsWithPositions, saveAccounts, type Account, type AccountKind } from "./accounts";
import { allocationByLocation, allocationByType, portfolioTotals, valuePosition, type ValuedPosition } from "./domain";
import { BOND_KINDS, getBondKind, type BondKind } from "./fixed-income";
import { formatNumber, formatPct, formatTry, relativeTime } from "./format";
import { GOLD_PRODUCTS, getGoldProduct, type GoldKind } from "./gold";
import { numberToPlainDecimal, parseLocalizedQuantity } from "./quantity";
import {
  finishOnboarding,
  isOnboardingDone,
  loadPositions,
  loadQuotes,
  makeExportFile,
  parseImportFile,
  savePositions,
  saveQuotes
} from "./storage";
import { ASSET_TYPES, assetKey, type AssetType, type CachedQuote, type Position } from "./types";

type GroupMode = "location" | "type";

const isUsSecurityType = (type: AssetType) => type === "stock" || type === "etf";

const EMPTY_FORM: Omit<Position, "id" | "createdAt"> = {
  type: "fund",
  symbol: "",
  name: "",
  quantity: 0,
  unitCostTry: undefined,
  manualPriceTry: undefined,
  location: "",
  note: ""
};

function App() {
  const [positions, setPositions] = useState<Position[]>(loadPositions);
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts(loadPositions()));
  const [quotes, setQuotes] = useState<Record<string, CachedQuote>>(loadQuotes);
  const [refreshing, setRefreshing] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("location");
  const [editing, setEditing] = useState<Position | "new" | null>(null);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingDone() && loadPositions().length === 0);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => savePositions(positions), [positions]);
  useEffect(() => saveAccounts(accounts), [accounts]);
  useEffect(() => setAccounts((current) => mergeAccountsWithPositions(current, positions)), [positions]);
  useEffect(() => saveQuotes(quotes), [quotes]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const refresh = useCallback(async () => {
    if (!positions.length) return;
    setRefreshing(true);
    setGlobalError("");
    try {
      const incoming = await fetchPrices(positions);
      setQuotes((current) => mergeQuotes(current, incoming));
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Fiyatlar güncellenemedi.");
    } finally {
      setRefreshing(false);
    }
  }, [positions]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const valued = useMemo(() => positions.map((position) => valuePosition(position, quotes)), [positions, quotes]);
  const totals = useMemo(() => portfolioTotals(valued), [valued]);
  const typeAllocation = useMemo(() => allocationByType(valued), [valued]);
  const locationAllocation = useMemo(() => allocationByLocation(valued), [valued]);
  const locations = useMemo(() => Array.from(new Set(positions.map((item) => item.location))).sort(), [positions]);
  const failedCount = useMemo(
    () => new Set(positions.filter((position) => quotes[assetKey(position.type, position.symbol)]?.status === "error").map((item) => assetKey(item.type, item.symbol))).size,
    [positions, quotes]
  );
  const hasSample = positions.some((position) => position.sample);
  const lastUpdated = useMemo(() => {
    const dates = Object.values(quotes).map((quote) => quote.fetchedAt).filter(Boolean).sort();
    return dates.at(-1);
  }, [quotes]);

  const filtered = valued.filter((item) =>
    (typeFilter === "all" || item.type === typeFilter) &&
    (locationFilter === "all" || item.location === locationFilter)
  );
  const groups = groupItems(filtered, groupMode);

  const savePosition = (position: Position) => {
    setPositions((current) => {
      const exists = current.some((item) => item.id === position.id);
      return exists ? current.map((item) => item.id === position.id ? position : item) : [...current, position];
    });
    setEditing(null);
    setNotice(editing === "new" ? "Varlık eklendi." : "Varlık güncellendi.");
  };

  const removePosition = (position: Position) => {
    if (!window.confirm(`${position.name} kaydını silmek istiyor musunuz?`)) return;
    setPositions((current) => current.filter((item) => item.id !== position.id));
    setNotice("Varlık silindi.");
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(makeExportFile(positions, accounts), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kasa-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Yerel yedek indirildi.");
  };

  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseImportFile(await file.text());
      if (positions.length && !window.confirm("Mevcut kayıtların tamamı bu yedekle değiştirilsin mi?")) return;
      setPositions(parsed.positions);
      setAccounts(parsed.accounts ?? mergeAccountsWithPositions([], parsed.positions));
      finishOnboarding();
      setShowOnboarding(false);
      setNotice(`${parsed.positions.length} kayıt içe aktarıldı.`);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Dosya içe aktarılamadı.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const loadSample = () => {
    setPositions(SAMPLE_POSITIONS.map((item) => ({ ...item, id: crypto.randomUUID() })));
    finishOnboarding();
    setShowOnboarding(false);
    setNotice("Örnek portföy yüklendi; dilediğiniz gibi değiştirebilirsiniz.");
  };

  const startEmpty = () => {
    finishOnboarding();
    setShowOnboarding(false);
    setShowAccounts(true);
  };

  const startAdding = () => {
    if (!accounts.length) {
      setShowAccounts(true);
      setNotice("Önce varlıklarınızın bulunduğu hesabı ekleyin.");
      return;
    }
    setEditing("new");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Kasa ana sayfa">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>Kasa</span>
        </a>
        <div className="top-actions">
          <span className="privacy-badge"><LockKeyhole size={14} /> Yalnızca bu cihaz</span>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void importData(event.target.files?.[0])}
          />
          <button className="icon-text-button" onClick={() => fileInput.current?.click()} title="JSON yedeği içe aktar">
            <Upload size={16} /><span>İçe aktar</span>
          </button>
          <button className="icon-text-button" onClick={exportData} disabled={!positions.length} title="JSON yedeği dışa aktar">
            <Download size={16} /><span>Yedekle</span>
          </button>
          <button className="icon-text-button" onClick={() => setShowAccounts(true)} title="Banka ve uygulamaları yönet">
            <Landmark size={16} /><span>Hesaplar</span>
          </button>
          <button className="primary-button compact" onClick={startAdding}>
            <Plus size={17} /> Varlık ekle
          </button>
        </div>
      </header>

      <main id="main" className="main-content">
        {showOnboarding ? (
          <Onboarding onSample={loadSample} onEmpty={startEmpty} onImport={() => fileInput.current?.click()} />
        ) : (
          <>
            <section className="overview" aria-label="Portföy özeti">
              <div className="balance-panel">
                <div className="eyebrow"><span className="live-dot" /> Bugünkü genel görünüm</div>
                <div className="balance-line">
                  <div>
                    <p className="label">Toplam birikim</p>
                    <h1>{formatTry(totals.totalValue)}</h1>
                  </div>
                  <ChangeBadge value={totals.dailyChangePct} detail={formatTry(Math.abs(totals.dailyChangeValue))} />
                </div>
                <div className="summary-strip">
                  <SummaryItem label="Bilinen toplam maliyet" value={formatTry(totals.totalCost)} />
                  <SummaryItem
                    label="Toplam kâr / zarar"
                    value={formatTry(totals.totalProfit)}
                    tone={totals.totalProfit > 0 ? "positive" : totals.totalProfit < 0 ? "negative" : undefined}
                  />
                  <div className="refresh-box">
                    <span>Son fiyat kontrolü</span>
                    <strong>{refreshing ? "Güncelleniyor…" : relativeTime(lastUpdated)}</strong>
                    <button onClick={() => void refresh()} disabled={refreshing || !positions.length} aria-label="Fiyatları yenile">
                      <RefreshCw size={17} className={refreshing ? "spin" : ""} />
                    </button>
                  </div>
                </div>
              </div>

              <AllocationCard allocation={typeAllocation} total={totals.totalValue} />
            </section>

            {(globalError || failedCount > 0) && (
              <div className="warning-banner" role="status">
                <AlertTriangle size={18} />
                <div>
                  <strong>{globalError || `${failedCount} varlık için güncel fiyat alınamadı.`}</strong>
                  <span>Varsa son başarılı değer gösteriliyor. Kaynak düzeldiğinde “Yenile” ile tekrar deneyin.</span>
                </div>
              </div>
            )}

            {hasSample && (
              <div className="sample-banner" role="status">
                <Info size={18} />
                <div><strong>Örnek portföyü görüntülüyorsunuz.</strong><span>Miktar ve maliyetler temsili; fiyatlar kaynaklardan güncelleniyor.</span></div>
                <button onClick={() => setPositions((current) => current.filter((position) => !position.sample))}>Örnekleri kaldır</button>
              </div>
            )}

            {positions.length ? (
              <>
                <section className="locations-section" aria-labelledby="locations-title">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Param nerede?</p>
                      <h2 id="locations-title">Hesaplar</h2>
                    </div>
                    <span>{locations.length} konum</span>
                  </div>
                  <div className="location-grid">
                    {locationAllocation.map((item, index) => (
                      <button
                        key={item.location}
                        className={`location-card ${locationFilter === item.location ? "selected" : ""}`}
                        onClick={() => setLocationFilter(locationFilter === item.location ? "all" : item.location)}
                      >
                        <span className={`location-icon tone-${index % 4}`}><WalletCards size={18} /></span>
                        <span><small>{item.location}</small><strong>{formatTry(item.value)}</strong></span>
                        <span className="location-share">{totals.totalValue ? Math.round(item.value / totals.totalValue * 100) : 0}%</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="holdings-card" aria-labelledby="holdings-title">
                  <div className="holdings-toolbar">
                    <div>
                      <p className="eyebrow">Tüm kayıtlar</p>
                      <h2 id="holdings-title">Varlıklarım <span>{filtered.length}</span></h2>
                    </div>
                    <div className="toolbar-controls">
                      <label>
                        <span className="sr-only">Varlık türü filtresi</span>
                        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AssetType | "all")}>
                          <option value="all">Tüm varlık türleri</option>
                          {ASSET_TYPES.map((type) => <option key={type} value={type}>{TYPE_META[type].label}</option>)}
                        </select>
                        <ChevronDown size={15} aria-hidden="true" />
                      </label>
                      <label>
                        <span className="sr-only">Hesap filtresi</span>
                        <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                          <option value="all">Tüm hesaplar</option>
                          {locations.map((location) => <option key={location}>{location}</option>)}
                        </select>
                        <ChevronDown size={15} aria-hidden="true" />
                      </label>
                      <div className="segmented" aria-label="Gruplama seçimi">
                        <button className={groupMode === "location" ? "active" : ""} onClick={() => setGroupMode("location")}>Hesaba göre</button>
                        <button className={groupMode === "type" ? "active" : ""} onClick={() => setGroupMode("type")}>Türe göre</button>
                      </div>
                    </div>
                  </div>

                  {filtered.length ? (
                    <div className="groups">
                      {groups.map(([group, items]) => (
                        <div className="asset-group" key={group}>
                          <div className="group-title"><span>{group}</span><small>{formatTry(items.reduce((sum, item) => sum + (item.value ?? 0), 0))}</small></div>
                          <div className="table-head" aria-hidden="true">
                            <span>Varlık</span><span>Miktar</span><span>Fiyat</span><span>Günlük</span><span>Değer</span><span>Kâr / Zarar</span><span />
                          </div>
                          {items.map((item) => (
                            <PositionRow key={item.id} item={item} onEdit={() => setEditing(item)} onDelete={() => removePosition(item)} />
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-filter-results"><Archive size={28} /><p>Bu filtrelerde kayıt bulunamadı.</p><button onClick={() => { setTypeFilter("all"); setLocationFilter("all"); }}>Filtreleri temizle</button></div>
                  )}
                </section>
              </>
            ) : (
              <EmptyState onAdd={startAdding} onSample={loadSample} />
            )}

            <footer>
              <span><ShieldCheck size={15} /> Portföy kayıtlarınız tarayıcınızda saklanır.</span>
              <span><Info size={15} /> Fiyatlar gecikmeli veya temsilî olabilir; yatırım danışmanlığı değildir.</span>
            </footer>
          </>
        )}
      </main>

      {editing && (
        <PositionModal
          position={editing === "new" ? undefined : editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSave={savePosition}
        />
      )}

      {showAccounts && (
        <AccountsModal
          accounts={accounts}
          positions={positions}
          onChange={setAccounts}
          onClose={() => setShowAccounts(false)}
        />
      )}

      {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
    </div>
  );
}

function Onboarding({ onSample, onEmpty, onImport }: { onSample: () => void; onEmpty: () => void; onImport: () => void }) {
  return (
    <section className="onboarding">
      <div className="onboarding-copy">
        <div className="onboarding-mark"><span>K</span><ShieldCheck size={23} /></div>
        <p className="eyebrow">Sade. Yerel. Size ait.</p>
        <h1>Birikiminizin tamamı,<br />tek ve sakin bir ekranda.</h1>
        <p>Midas, Paribu, bankalar ve fiziksel kasadaki varlıklarınızı elle ekleyin. Kasa hiçbir hesabınıza bağlanmaz; kayıtlar bu tarayıcıdan çıkmaz.</p>
        <div className="onboarding-points">
          <span><Check size={16} /> Hesap bağlantısı yok</span>
          <span><Check size={16} /> Üyelik yok</span>
          <span><Check size={16} /> İşlem ve öneri yok</span>
        </div>
      </div>
      <div className="onboarding-card">
        <div className="sample-preview" aria-hidden="true">
          <div><small>Örnek toplam</small><strong>₺284.650</strong><span>+1,24%</span></div>
          <div className="mini-bars"><i /><i /><i /><i /></div>
          <ul><li><b />Midas <span>₺92.400</span></li><li><b />İş Bankası <span>₺74.250</span></li><li><b />Paribu <span>₺68.800</span></li></ul>
        </div>
        <h2>Nasıl başlamak istersiniz?</h2>
        <p>Örnek kayıtlar tamamen temsili ve dilediğiniz zaman silinebilir.</p>
        <button className="primary-button" onClick={onSample}><WalletCards size={18} /> Örnek portföyü incele</button>
        <button className="secondary-button" onClick={onEmpty}><Plus size={18} /> Kendi varlığımı ekle</button>
        <button className="text-button" onClick={onImport}><FileJson size={17} /> Bir Kasa yedeğini içe aktar</button>
      </div>
    </section>
  );
}

function AllocationCard({ allocation, total }: { allocation: ReturnType<typeof allocationByType>; total: number }) {
  let progress = 0;
  const stops = allocation.flatMap((item) => {
    const start = progress;
    progress += total ? (item.value / total) * 100 : 0;
    return [`${item.color} ${start}%`, `${item.color} ${progress}%`];
  });
  const gradient = stops.length ? `conic-gradient(${stops.join(",")})` : "conic-gradient(#ddd 0 100%)";
  return (
    <div className="allocation-card">
      <div className="card-heading"><div><p className="eyebrow">Dağılım</p><h2>Varlık türleri</h2></div><span>TL</span></div>
      <div className="allocation-content">
        <div className="donut" style={{ background: gradient }} role="img" aria-label="Varlık türü dağılım grafiği">
          <div><small>Toplam</small><strong>{formatTry(total, true)}</strong></div>
        </div>
        <ul className="allocation-list">
          {allocation.length ? allocation.map((item) => (
            <li key={item.type}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{total ? Math.round(item.value / total * 100) : 0}%</strong></li>
          )) : <li className="muted">Fiyatlar geldiğinde dağılım burada görünür.</li>}
        </ul>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="summary-item"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function ChangeBadge({ value, detail }: { value: number; detail: string }) {
  const positive = value >= 0;
  return (
    <div className={`change-badge ${positive ? "positive" : "negative"}`}>
      {positive ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
      <strong>{formatPct(value)}</strong><span>bugün · {detail}</span>
    </div>
  );
}

function PositionRow({ item, onEdit, onDelete }: { item: ValuedPosition; onEdit: () => void; onDelete: () => void }) {
  const type = TYPE_META[item.type];
  const quoteError = item.quote?.status === "error";
  const goldProduct = item.type === "gold" ? getGoldProduct(item.goldKind) : undefined;
  const goldDetail = goldProduct?.unit === "adet"
    ? `${formatNumber(goldProduct.grossWeightGrams)} g · ${goldProduct.purityLabel}`
    : goldProduct?.purityLabel;
  const bondDetail = item.type === "bond"
    ? `${getBondKind(item.bondKind).label}${item.maturityDate ? ` · Vade ${new Date(`${item.maturityDate}T12:00:00`).toLocaleDateString("tr-TR")}` : ""}`
    : undefined;
  return (
    <div className="position-row">
      <div className="asset-cell">
        <span className="asset-avatar" style={{ color: type.color, background: `${type.color}16` }}>{displaySymbol(item.type, item.symbol).slice(0, 3)}</span>
        <span>
          <strong>{item.name}</strong>
          <small>{goldDetail ?? bondDetail ?? displaySymbol(item.type, item.symbol)} · {item.location}</small>
          {item.note && <span className="position-note" title={item.note}>{item.note}</span>}
        </span>
      </div>
      <div className="data-cell"><small>Miktar</small><strong>{formatNumber(item.quantity)}{goldProduct ? ` ${goldProduct.unit}` : ""}</strong></div>
      <div className="data-cell price-cell">
        <small>{goldProduct ? `Metal / ${goldProduct.unit}` : item.type === "bond" ? "Manuel değer" : "Fiyat"}</small><strong>{formatTry(item.unitPrice)}</strong>
        {quoteError && <span className="source-error" title={item.quote?.error}><AlertTriangle size={12} /> Son değer</span>}
      </div>
      <div className={`data-cell ${Number(item.quote?.changePct) >= 0 ? "positive" : "negative"}`}><small>Günlük</small><strong>{formatPct(item.quote?.changePct)}</strong></div>
      <div className="data-cell emphasis"><small>Değer</small><strong>{formatTry(item.value)}</strong></div>
      <div className={`data-cell ${Number(item.profit) >= 0 ? "positive" : "negative"}`}><small>Kâr / Zarar</small><strong>{item.profit == null ? "—" : formatTry(item.profit)}</strong></div>
      <div className="row-actions">
        <button onClick={onEdit} aria-label={`${item.name} kaydını düzenle`}><Pencil size={15} /></button>
        <button onClick={onDelete} aria-label={`${item.name} kaydını sil`}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd, onSample }: { onAdd: () => void; onSample: () => void }) {
  return (
    <section className="empty-state">
      <span><WalletCards size={28} /></span>
      <h2>Kasanız henüz boş</h2>
      <p>İlk varlığınızı ekleyerek birikiminizin sade özetini oluşturmaya başlayın.</p>
      <div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Varlık ekle</button><button className="text-button" onClick={onSample}>Örneği göster</button></div>
    </section>
  );
}

function PositionModal({ position, accounts, onClose, onSave }: { position?: Position; accounts: Account[]; onClose: () => void; onSave: (position: Position) => void }) {
  const [form, setForm] = useState<Omit<Position, "id" | "createdAt">>(position ? {
    type: position.type,
    symbol: position.symbol,
    name: position.name,
    quantity: position.quantity,
    unitCostTry: position.unitCostTry,
    location: position.location,
    goldKind: position.goldKind,
    bondKind: position.bondKind,
    manualPriceTry: position.manualPriceTry,
    maturityDate: position.maturityDate,
    note: position.note ?? ""
  } : EMPTY_FORM);
  const [error, setError] = useState("");
  const [quantityInput, setQuantityInput] = useState(position ? numberToPlainDecimal(position.quantity) : "");
  const [fundQuery, setFundQuery] = useState(
    position?.type === "fund" ? `${position.symbol} · ${position.name}` : ""
  );
  const [fundOptions, setFundOptions] = useState<FundSearchItem[]>([]);
  const [fundSearchState, setFundSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [fundSearchError, setFundSearchError] = useState("");
  const [fundSelected, setFundSelected] = useState(position?.type === "fund");
  const [showFundResults, setShowFundResults] = useState(false);
  const [fundCatalogMeta, setFundCatalogMeta] = useState<{ total: number; stale: boolean; warning?: string; catalogVersion: number }>();
  const [bistState, setBistState] = useState<"idle" | "loading" | "ready" | "error">(position?.type === "bist" ? "ready" : "idle");
  const [bistError, setBistError] = useState("");
  const [bistVerifiedSymbol, setBistVerifiedSymbol] = useState(position?.type === "bist" ? normalizeBistSymbol(position.symbol) : "");
  const [usQuery, setUsQuery] = useState(position && isUsSecurityType(position.type) ? `${position.symbol} · ${position.name}` : "");
  const [usOptions, setUsOptions] = useState<UsSecuritySearchItem[]>([]);
  const [usState, setUsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [usError, setUsError] = useState("");
  const [usWarning, setUsWarning] = useState("");
  const [usSelected, setUsSelected] = useState(Boolean(position && isUsSecurityType(position.type)));
  const [showUsResults, setShowUsResults] = useState(false);
  const symbolInput = useRef<HTMLInputElement>(null);
  const selectedGold = form.type === "gold" ? getGoldProduct(form.goldKind) : undefined;
  const selectedBond = form.type === "bond" ? getBondKind(form.bondKind) : undefined;
  const selectedFund = form.type === "fund" ? fundOptions.find((fund) => fund.code === form.symbol) : undefined;

  useEffect(() => {
    symbolInput.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (form.type !== "fund" || fundSelected) return;
    const query = fundQuery.trim();
    if (query.length < 2) {
      setFundOptions([]);
      setFundSearchState("idle");
      setFundSearchError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setFundSearchState("loading");
      setFundSearchError("");
      try {
        const result = await searchTefasFunds(query, controller.signal);
        setFundOptions(result.funds);
        setFundCatalogMeta({ total: result.meta.total, stale: result.meta.stale, warning: result.meta.warning, catalogVersion: result.meta.catalogVersion });
        setFundSearchState("ready");
        const exact = result.funds.find((fund) => fund.code === query.toUpperCase());
        if (exact) {
          setForm((current) => ({ ...current, symbol: exact.code, name: exact.name }));
          setFundQuery(`${exact.code} · ${exact.name}`);
          setFundSelected(true);
          setShowFundResults(false);
        } else {
          setShowFundResults(true);
        }
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        setFundOptions([]);
        setFundSearchState("error");
        setFundSearchError(searchError instanceof Error ? searchError.message : "TEFAS fon kataloğu alınamadı.");
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.type, fundQuery, fundSelected]);

  useEffect(() => {
    if (form.type !== "bist") return;
    const symbol = normalizeBistSymbol(form.symbol);
    if (!isValidBistSymbol(symbol) || bistVerifiedSymbol === symbol) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBistState("loading");
      setBistError("");
      try {
        const stock = await resolveBistStock(symbol, controller.signal);
        setForm((current) => current.type === "bist" && normalizeBistSymbol(current.symbol) === symbol
          ? { ...current, symbol: stock.symbol, name: stock.name }
          : current);
        setBistVerifiedSymbol(stock.symbol);
        setBistState("ready");
      } catch (resolveError) {
        if (resolveError instanceof DOMException && resolveError.name === "AbortError") return;
        setBistState("error");
        setBistError(resolveError instanceof Error ? resolveError.message : "BIST hissesi doğrulanamadı.");
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [bistVerifiedSymbol, form.symbol, form.type]);

  useEffect(() => {
    if (!isUsSecurityType(form.type) || usSelected) return;
    const query = usQuery.trim();
    if (!query) {
      setUsOptions([]);
      setUsState("idle");
      setUsError("");
      setUsWarning("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUsState("loading");
      setUsError("");
      try {
        const result = form.type === "etf"
          ? await searchUsEtfs(query, controller.signal)
          : await searchUsStocks(query, controller.signal);
        const securities = "etfs" in result ? result.etfs : result.stocks;
        setUsOptions(securities);
        setUsWarning(result.meta.warning ?? "");
        setUsState("ready");
        const exact = securities.find((security) => security.symbol === query.toUpperCase());
        if (exact) {
          setForm((current) => ({ ...current, symbol: exact.symbol, name: exact.name }));
          setUsQuery(`${exact.symbol} · ${exact.name}`);
          setUsSelected(true);
          setShowUsResults(false);
        } else {
          setShowUsResults(true);
        }
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        setUsOptions([]);
        setUsState("error");
        setUsError(searchError instanceof Error ? searchError.message : `${form.type === "etf" ? "ABD ETF" : "ABD hissesi"} araması kullanılamıyor.`);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.type, usQuery, usSelected]);

  const updateType = (type: AssetType) => {
    const goldProduct = type === "gold" ? getGoldProduct("gram") : undefined;
    const bondKind = type === "bond" ? getBondKind("bono") : undefined;
    setForm({
      ...EMPTY_FORM,
      type,
      symbol: goldProduct?.symbol ?? "",
      name: goldProduct?.name ?? "",
      location: form.location,
      goldKind: goldProduct?.id,
      bondKind: bondKind?.id
    });
    setFundQuery("");
    setFundOptions([]);
    setFundSelected(false);
    setFundSearchState("idle");
    setFundSearchError("");
    setBistState("idle");
    setBistError("");
    setBistVerifiedSymbol("");
    setQuantityInput("");
    setUsQuery("");
    setUsOptions([]);
    setUsState("idle");
    setUsError("");
    setUsWarning("");
    setUsSelected(false);
  };

  const updateGoldKind = (goldKind: GoldKind) => {
    const product = getGoldProduct(goldKind);
    setForm((current) => ({
      ...current,
      goldKind,
      symbol: product.symbol,
      name: product.name
    }));
    setError("");
  };

  const updateSymbol = (symbol: string) => {
    const normalized = form.type === "crypto"
      ? symbol.trim().toLowerCase()
      : form.type === "bist"
        ? normalizeBistSymbol(symbol)
        : symbol.trim().toUpperCase();
    const found = catalogFor(form.type).find((item) => item.symbol.toLowerCase() === normalized.toLowerCase());
    if (form.type === "bist") {
      setBistVerifiedSymbol("");
      setBistState("idle");
      setBistError("");
    }
    setForm((current) => ({ ...current, symbol: normalized, name: found?.name ?? (form.type === "bist" ? "" : current.name) }));
  };

  const updateFundQuery = (value: string) => {
    const possibleCode = value.trim().toUpperCase();
    const manualCode = /^[A-Z0-9]{2,10}$/.test(possibleCode) ? possibleCode : "";
    setFundQuery(value);
    setFundSelected(false);
    setShowFundResults(true);
    setForm((current) => ({ ...current, symbol: manualCode, name: "" }));
  };

  const selectFund = (fund: FundSearchItem) => {
    setForm((current) => ({ ...current, symbol: fund.code, name: fund.name }));
    setFundQuery(`${fund.code} · ${fund.name}`);
    setFundSelected(true);
    setShowFundResults(false);
    setError("");
  };

  const updateUsQuery = (value: string) => {
    setUsQuery(value);
    setUsSelected(false);
    setShowUsResults(true);
    setUsWarning("");
    setForm((current) => ({ ...current, symbol: "", name: "" }));
  };

  const selectUsSecurity = (security: UsSecuritySearchItem) => {
    setForm((current) => ({ ...current, symbol: security.symbol, name: security.name }));
    setUsQuery(`${security.symbol} · ${security.name}`);
    setUsSelected(true);
    setShowUsResults(false);
    setError("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsedQuantity = parseLocalizedQuantity(quantityInput);
    const goldProduct = form.type === "gold" ? getGoldProduct(form.goldKind) : undefined;
    const normalizedSymbol = goldProduct?.symbol ?? (form.type === "bond"
      ? form.symbol.trim().toUpperCase() || getBondKind(form.bondKind).label.toLocaleUpperCase("tr-TR")
      : form.type === "crypto"
      ? form.symbol.trim().toLowerCase()
      : form.type === "bist"
        ? normalizeBistSymbol(form.symbol)
        : form.symbol.trim().toUpperCase());
    if (form.type === "fund" && !/^[A-Z0-9]{2,10}$/.test(normalizedSymbol)) {
      setError("Listeden bir fon seçin veya geçerli TEFAS fon kodunu elle girin.");
      return;
    }
    if (form.type === "bist" && (!isValidBistSymbol(normalizedSymbol) || bistVerifiedSymbol !== normalizedSymbol)) {
      setError("BIST kodunun canlı doğrulanmasını bekleyin veya geçerli bir kod girin.");
      return;
    }
    if (isUsSecurityType(form.type) && (!usSelected || !normalizedSymbol)) {
      setError(`Listeden doğrulanmış bir ABD ${form.type === "etf" ? "ETF'i" : "hissesi"} seçin veya geçerli sembolü tam olarak girin.`);
      return;
    }
    if (form.type === "bond" && (form.manualPriceTry == null || !(form.manualPriceTry > 0))) {
      setError("Bono veya tahvil için güncel birim TL değerini girin.");
      return;
    }
    if (!normalizedSymbol || (form.type !== "fund" && !form.name.trim()) || !form.location.trim() || parsedQuantity == null || !(parsedQuantity > 0)) {
      setError("Varlık, miktar ve bulunduğu yer alanlarını doldurun.");
      return;
    }
    if (form.unitCostTry != null && form.unitCostTry < 0) {
      setError("Maliyet sıfırdan küçük olamaz.");
      return;
    }
    if (goldProduct?.unit === "adet" && !Number.isInteger(parsedQuantity)) {
      setError("Bu altın türü adetle izlenir; miktarı tam sayı girin.");
      return;
    }
    if ((form.note?.length ?? 0) > 500) {
      setError("Not en fazla 500 karakter olabilir.");
      return;
    }
    onSave({
      ...form,
      symbol: normalizedSymbol,
      name: goldProduct?.name ?? (form.name.trim() || `${normalizedSymbol} TEFAS Fonu`),
      goldKind: goldProduct?.id,
      bondKind: form.type === "bond" ? getBondKind(form.bondKind).id : undefined,
      quantity: parsedQuantity,
      location: form.location.trim(),
      note: form.note?.trim() ?? "",
      id: position?.id ?? crypto.randomUUID(),
      createdAt: position?.createdAt ?? new Date().toISOString()
    });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div><p className="eyebrow">Portföy kaydı</p><h2 id="modal-title">{position ? "Varlığı düzenle" : "Yeni varlık ekle"}</h2></div>
          <button onClick={onClose} aria-label="Pencereyi kapat"><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <fieldset className="type-picker">
            <legend>Varlık türü</legend>
            {ASSET_TYPES.map((type) => (
              <button type="button" key={type} className={form.type === type ? "selected" : ""} onClick={() => updateType(type)}>
                <i style={{ background: TYPE_META[type].color }} />{TYPE_META[type].label}
              </button>
            ))}
          </fieldset>

          <div className="form-grid">
            {form.type === "fund" ? (
              <div className="field span-2">
                <label htmlFor="fund-search">Fon kodu veya Türkçe fon adı</label>
                <div className="fund-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    id="fund-search"
                    ref={symbolInput}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showFundResults && fundOptions.length > 0}
                    aria-controls="fund-search-results"
                    value={fundQuery}
                    onChange={(event) => updateFundQuery(event.target.value)}
                    onFocus={() => !fundSelected && setShowFundResults(true)}
                    onBlur={() => window.setTimeout(() => setShowFundResults(false), 120)}
                    onKeyDown={(event) => event.key === "Escape" && setShowFundResults(false)}
                    placeholder="Örn. AFT veya teknoloji"
                    autoComplete="off"
                  />
                  {fundSearchState === "loading" && <RefreshCw className="fund-search-spinner spin" size={15} aria-label="Fonlar aranıyor" />}
                  {showFundResults && fundOptions.length > 0 && (
                    <div id="fund-search-results" className="fund-results" role="listbox">
                      {fundOptions.map((fund) => (
                        <button key={fund.code} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => selectFund(fund)}>
                          <b>{fund.code}</b>
                          <span>{fund.name}<small>{fund.fundTypeLabel}</small></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {fundSearchState === "error" ? (
                  <small className="field-message error"><AlertTriangle size={12} />{fundSearchError} Geçerli fon kodunu elle girebilirsiniz.</small>
                ) : fundSearchState === "ready" && !fundOptions.length ? (
                  <small className="field-message">Sonuç bulunamadı. Geçerli TEFAS kodunu elle girebilirsiniz.</small>
                ) : fundSelected ? (
                  <small className="field-message success"><Check size={12} />{selectedFund?.fundType === "CODE" ? "Resmî TEFAS fiyat ucunda kodu ve adı doğrulandı." : "TEFAS kataloğundan seçildi."}</small>
                ) : (
                  <small className="field-message">Resmî TEFAS aktif fon kataloğu · {fundCatalogMeta ? `${fundCatalogMeta.total.toLocaleString("tr-TR")} fon · ` : ""}6 saatlik yerel önbellek{fundCatalogMeta?.stale ? " · Son başarılı katalog" : ""}</small>
                )}
                {fundCatalogMeta?.warning && <small className="field-message warning"><AlertTriangle size={12} />{fundCatalogMeta.warning}</small>}
              </div>
            ) : isUsSecurityType(form.type) ? (
              <div className="field span-2">
                <label htmlFor="us-security-search">ABD {form.type === "etf" ? "ETF" : "hisse"} sembolü veya adı</label>
                <div className="fund-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    id="us-security-search"
                    ref={symbolInput}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showUsResults && usOptions.length > 0}
                    aria-controls="us-security-results"
                    value={usQuery}
                    onChange={(event) => updateUsQuery(event.target.value)}
                    onFocus={() => !usSelected && setShowUsResults(true)}
                    onBlur={() => window.setTimeout(() => setShowUsResults(false), 120)}
                    placeholder={form.type === "etf" ? "Örn. NASA, COPX veya VOO" : "Örn. AAPL, TSLA veya Apple"}
                    autoComplete="off"
                  />
                  {usState === "loading" && <RefreshCw className="fund-search-spinner spin" size={15} aria-label={`ABD ${form.type === "etf" ? "ETF'leri" : "hisseleri"} aranıyor`} />}
                  {showUsResults && usOptions.length > 0 && (
                    <div id="us-security-results" className="fund-results" role="listbox">
                      {usOptions.map((security) => (
                        <button key={security.symbol} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => selectUsSecurity(security)}>
                          <b>{security.symbol}</b>
                          <span>{security.name}<small>{security.exchange} · {security.securityType === "etf" ? "ETF" : "Hisse"} · USD</small></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {usState === "error" ? (
                  <small className="field-message error"><AlertTriangle size={12} />{usError}</small>
                ) : usSelected ? (
                  <small className="field-message success"><Check size={12} />ABD {form.type === "etf" ? "ETF'i" : "hissesi"} Yahoo Finance fiyatıyla doğrulandı.</small>
                ) : usState === "ready" && !usOptions.length ? (
                  <small className="field-message warning"><AlertTriangle size={12} />Doğrulanmış ABD {form.type === "etf" ? "ETF'i" : "hissesi"} bulunamadı.</small>
                ) : (
                  <small className="field-message">Dinamik Yahoo Finance araması · {form.type === "etf" ? "ABD ETF ve NYSE Arca" : "NASDAQ/NYSE equity"} sonuçları · 10 dakika sunucu önbelleği.</small>
                )}
                {usWarning && <small className="field-message warning"><AlertTriangle size={12} />{usWarning}</small>}
                <small>Gecikmeli sağlayıcı verisidir; Midas 24 saatlik işlem fiyatıyla birebir eşleşmeyebilir.</small>
              </div>
            ) : form.type === "gold" ? (
              <div className="field span-2">
                <label htmlFor="gold-kind">Altın türü</label>
                <select id="gold-kind" value={selectedGold?.id ?? "gram"} onChange={(event) => updateGoldKind(event.target.value as GoldKind)}>
                  {GOLD_PRODUCTS.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
                <small>
                  {selectedGold?.unit === "adet"
                    ? `Darphane standardı: ${formatNumber(selectedGold.grossWeightGrams)} g brüt · ${selectedGold.purityLabel}.`
                    : "24 ayar saf gram gösterge birimi."}
                </small>
              </div>
            ) : form.type === "bond" ? (
              <>
                <label className="field">
                  <span>Borçlanma aracı</span>
                  <select value={selectedBond?.id ?? "bono"} onChange={(event) => setForm({ ...form, bondKind: event.target.value as BondKind })}>
                    {BOND_KINDS.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}
                  </select>
                  <small>{selectedBond?.hint}</small>
                </label>
                <label className="field">
                  <span>ISIN / kısa kod <em>opsiyonel</em></span>
                  <input ref={symbolInput} value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })} placeholder="Örn. TRB..." />
                </label>
              </>
            ) : (
              <label className="field span-2">
                <span>{form.type === "bist" ? "BIST kodu" : form.type === "crypto" ? "CoinGecko kimliği" : form.type === "fx" ? "Para birimi" : "Varlık"}</span>
                <input
                  ref={symbolInput}
                  list={`catalog-${form.type}`}
                  value={form.symbol}
                  onChange={(event) => updateSymbol(event.target.value)}
                  placeholder={TYPE_META[form.type].hint}
                  autoComplete="off"
                />
                <datalist id={`catalog-${form.type}`}>
                  {catalogFor(form.type).map((item) => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}
                </datalist>
                {form.type === "crypto" && <small>CoinGecko URL’sindeki kimliği kullanın; örn. bitcoin veya ethereum.</small>}
                {form.type === "bist" && bistState === "loading" && <small className="field-message"><RefreshCw className="spin" size={12} />Yahoo Finance üzerinde doğrulanıyor…</small>}
                {form.type === "bist" && bistState === "ready" && <small className="field-message success"><Check size={12} />{form.name} · TRY · arka planda {yahooBistSymbol(form.symbol)}</small>}
                {form.type === "bist" && bistState === "error" && <small className="field-message error"><AlertTriangle size={12} />{bistError}</small>}
                {form.type === "bist" && <small>Yahoo Finance gecikmeli sağlayıcı verisidir; resmî Borsa İstanbul verisi değildir.</small>}
              </label>
            )}
            {form.type !== "gold" && (
              <label className="field span-2">
                <span>Görünen ad {form.type === "fund" && <em>seçimde otomatik</em>}</span>
                <input value={form.name} readOnly={form.type === "bist" || isUsSecurityType(form.type)} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={form.type === "fund" || form.type === "bist" || isUsSecurityType(form.type) ? "Doğrulamada otomatik dolar" : form.type === "bond" ? "Örn. 6 ay vadeli Hazine bonosu" : "Örn. Apple"} />
              </label>
            )}
            <label className="field">
              <span>Miktar {selectedGold ? `(${selectedGold.unit})` : ""}</span>
              <input type="text" inputMode="decimal" value={quantityInput} onChange={(event) => setQuantityInput(event.target.value)} placeholder={selectedGold?.unit === "adet" ? "Örn. 3" : form.type === "crypto" ? "Örn. 0,0000003" : "Örn. 0,25"} aria-describedby="quantity-help" />
              <small id="quantity-help">Virgül veya nokta kullanabilirsiniz; değer yuvarlanmadan saklanır.</small>
            </label>
            <label className="field">
              <span>Birim alış maliyeti <em>opsiyonel</em></span>
              <div className="input-prefix"><b>₺</b><input type="number" min="0" step="any" inputMode="decimal" value={form.unitCostTry ?? ""} onChange={(event) => setForm({ ...form, unitCostTry: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="0,00" /></div>
              <small>{selectedGold ? `Bir ${selectedGold.unit} için ödediğiniz TL tutarı.` : "Bir adet / pay için ödediğiniz TL tutarı."}</small>
            </label>
            {form.type === "bond" && (
              <>
                <label className="field">
                  <span>Güncel birim değer</span>
                  <div className="input-prefix"><b>₺</b><input type="number" min="0" step="any" inputMode="decimal" value={form.manualPriceTry ?? ""} onChange={(event) => setForm({ ...form, manualPriceTry: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="0,00" /></div>
                  <small>Otomatik fiyat kaynağı olmadığı için elle güncellenir.</small>
                </label>
                <label className="field">
                  <span>Vade tarihi <em>opsiyonel</em></span>
                  <input type="date" value={form.maturityDate ?? ""} onChange={(event) => setForm({ ...form, maturityDate: event.target.value || undefined })} />
                </label>
              </>
            )}
            <label className="field span-2">
              <span>Bulunduğu yer / hesap</span>
              <select value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })}>
                <option value="" disabled>Bir hesap seçin</option>
                {accounts.map((account) => <option key={account.id} value={account.name}>{account.name} · {ACCOUNT_KIND_LABELS[account.kind]}</option>)}
              </select>
              <small>Listeyi üst menüdeki Hesaplar bölümünden yönetebilirsiniz.</small>
            </label>
            <label className="field span-2">
              <span>Not <em>opsiyonel</em></span>
              <textarea maxLength={500} rows={3} value={form.note ?? ""} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Örn. Teyzemin hediyesi" />
              <small>{form.note?.length ?? 0}/500 · Not düz metin olarak güvenle gösterilir.</small>
            </label>
          </div>
          {selectedGold && (
            <div className="gold-valuation-note">
              <Info size={16} />
              <span>{selectedGold.unit === "adet" ? `Yaklaşık metal değeri: saf gram altın fiyatı × ${formatNumber(selectedGold.grossWeightGrams)} g × ${selectedGold.purityLabel.split(" · ")[0]}. ` : "Yaklaşık değer, saf gram altın gösterge fiyatıdır. "}Kuyumcu/banka alış-satış farkı, işçilik ve sikke primi dahil değildir.</span>
            </div>
          )}
          {error && <p className="form-error"><AlertTriangle size={15} />{error}</p>}
          <div className="modal-note"><ShieldCheck size={16} /><span>Bu kayıt yalnızca tarayıcınızın yerel depolamasına yazılır.</span></div>
          <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" type="submit">{position ? "Değişiklikleri kaydet" : "Varlığı ekle"}</button></div>
        </form>
      </div>
    </div>
  );
}

function AccountsModal({ accounts, positions, onChange, onClose }: { accounts: Account[]; positions: Position[]; onChange: (accounts: Account[]) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("bank");
  const [error, setError] = useState("");

  const addAccount = (event: FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Banka, uygulama veya hesap adını girin.");
      return;
    }
    if (accounts.some((account) => account.name.toLocaleLowerCase("tr-TR") === cleanName.toLocaleLowerCase("tr-TR"))) {
      setError("Bu hesap zaten listede.");
      return;
    }
    onChange([...accounts, { id: crypto.randomUUID(), name: cleanName, kind }].sort((a, b) => a.name.localeCompare(b.name, "tr")));
    setName("");
    setError("");
  };

  const chooseSuggestion = (suggestedName: string) => {
    const suggestion = ACCOUNT_SUGGESTIONS.find((item) => item.name === suggestedName);
    setName(suggestedName);
    if (suggestion) setKind(suggestion.kind);
    setError("");
  };

  const removeAccount = (account: Account) => {
    if (positions.some((position) => position.location === account.name)) {
      setError(`${account.name} bir varlıkta kullanılıyor; önce o varlığın hesabını değiştirin.`);
      return;
    }
    if (!window.confirm(`${account.name} hesabını listeden kaldırmak istiyor musunuz?`)) return;
    onChange(accounts.filter((item) => item.id !== account.id));
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <div className="modal accounts-modal" role="dialog" aria-modal="true" aria-labelledby="accounts-modal-title">
        <div className="modal-header">
          <div><p className="eyebrow">Önce hesaplar</p><h2 id="accounts-modal-title">Banka ve uygulamalarım</h2></div>
          <button onClick={onClose} aria-label="Pencereyi kapat"><X size={20} /></button>
        </div>
        <form onSubmit={addAccount}>
          <p className="modal-intro">Yalnızca kullandığınız banka, aracı kurum, kripto borsası veya fiziksel kasayı ekleyin. Varlık eklerken bulunduğu yeri bu listeden seçeceksiniz.</p>
          <div className="form-grid">
            <label className="field span-2">
              <span>Hazır listeden seçin veya ad yazın</span>
              <input list="account-suggestions" value={name} onChange={(event) => chooseSuggestion(event.target.value)} placeholder="Örn. Ziraat Bankası" autoFocus />
              <datalist id="account-suggestions">{ACCOUNT_SUGGESTIONS.map((item) => <option key={item.name} value={item.name}>{ACCOUNT_KIND_LABELS[item.kind]}</option>)}</datalist>
            </label>
            <label className="field span-2">
              <span>Hesap türü</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
                {ACCOUNT_KINDS.map((item) => <option key={item} value={item}>{ACCOUNT_KIND_LABELS[item]}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="form-error"><AlertTriangle size={15} />{error}</p>}
          <button className="primary-button account-add-button" type="submit"><Plus size={17} /> Hesabı ekle</button>

          <div className="account-list">
            <div className="account-list-heading"><strong>Kayıtlı hesaplar</strong><span>{accounts.length}</span></div>
            {accounts.length ? accounts.map((account) => {
              const usedCount = positions.filter((position) => position.location === account.name).length;
              return (
                <div className="account-list-row" key={account.id}>
                  <span className="location-icon"><Landmark size={17} /></span>
                  <span><strong>{account.name}</strong><small>{ACCOUNT_KIND_LABELS[account.kind]}{usedCount ? ` · ${usedCount} varlık` : ""}</small></span>
                  <button type="button" onClick={() => removeAccount(account)} aria-label={`${account.name} hesabını kaldır`}><Trash2 size={16} /></button>
                </div>
              );
            }) : <div className="account-list-empty">Henüz hesap eklenmedi.</div>}
          </div>
          <div className="modal-note"><ShieldCheck size={16} /><span>Hesap adları yalnızca bu tarayıcıda saklanır; hiçbir bankaya bağlantı kurulmaz.</span></div>
          <div className="modal-footer"><button className="primary-button" type="button" onClick={onClose}>Tamam</button></div>
        </form>
      </div>
    </div>
  );
}

function groupItems(items: ValuedPosition[], mode: GroupMode): [string, ValuedPosition[]][] {
  const groups = new Map<string, ValuedPosition[]>();
  for (const item of items) {
    const key = mode === "location" ? item.location : TYPE_META[item.type].label;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return Array.from(groups.entries()).sort((a, b) => b[1].reduce((sum, item) => sum + (item.value ?? 0), 0) - a[1].reduce((sum, item) => sum + (item.value ?? 0), 0));
}

export default App;
