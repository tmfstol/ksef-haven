import { useState, useEffect } from "react";
import TeamManagement from "@/components/settings/TeamManagement";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCompanies, useAddCompany, useUpdateCompany, useDeleteCompany } from "@/hooks/useCompanies";
import { useTestConnection } from "@/hooks/useSettings";
import { ArrowLeft, Save, Loader2, Wifi, Shield, FolderOpen, Building2, Trash2, Plus, MapPin, CreditCard, Hash, Mail, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import type { Company } from "@/types/company";

interface SettingsPageProps {
  isOnboarding?: boolean;
}

const Settings = ({ isOnboarding = false }: SettingsPageProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("company");

  const { data: companies, isLoading } = useCompanies();
  const addMutation = useAddCompany();
  const updateMutation = useUpdateCompany();
  const deleteMutation = useDeleteCompany();
  const testMutation = useTestConnection();

  const [name, setName] = useState("");
  const [nip, setNip] = useState("");
  const [ksefToken, setKsefToken] = useState("");
  const [storagePath, setStoragePath] = useState("\\\\TB-AFS\\Archive");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("PL");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [invoicePattern, setInvoicePattern] = useState("FV/{NNN}/{MM}/{RRRR}");
  const [clientPortalEmail, setClientPortalEmail] = useState("");
  const [makeWebhookUrl, setMakeWebhookUrl] = useState("");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Load company data for editing
  useEffect(() => {
    if (editId && companies) {
      const company = companies.find((c) => c.id === editId);
      if (company) {
        setEditingCompany(company);
        setName(company.name);
        setNip(company.nip);
        setKsefToken("••••••••");
        setStoragePath(company.storage_path);
        setStreet(company.street || "");
        setCity(company.city || "");
        setPostalCode(company.postal_code || "");
        setCountryCode(company.country_code || "PL");
        setBankName(company.bank_name || "");
        setBankAccount(company.bank_account || "");
        setEmail(company.email || "");
        setPhone(company.phone || "");
        setInvoicePattern(company.invoice_pattern || "FV/{NNN}/{MM}/{RRRR}");
        setClientPortalEmail(company.client_portal_email || "");
        setMakeWebhookUrl(company.make_webhook_url || "");
      }
    }
  }, [editId, companies]);

  const handleSelectCompany = (company: Company) => {
    setEditingCompany(company);
    setName(company.name);
    setNip(company.nip);
    setKsefToken("••••••••");
    setStoragePath(company.storage_path);
    setStreet(company.street || "");
    setCity(company.city || "");
    setPostalCode(company.postal_code || "");
    setCountryCode(company.country_code || "PL");
    setBankName(company.bank_name || "");
    setBankAccount(company.bank_account || "");
    setEmail(company.email || "");
    setPhone(company.phone || "");
    setInvoicePattern(company.invoice_pattern || "FV/{NNN}/{MM}/{RRRR}");
    setClientPortalEmail(company.client_portal_email || "");
    setMakeWebhookUrl(company.make_webhook_url || "");
  };

  const handleNewCompany = () => {
    setEditingCompany(null);
    setName("");
    setNip("");
    setKsefToken("");
    setStoragePath("\\\\TB-AFS\\Archive");
    setStreet("");
    setCity("");
    setPostalCode("");
    setCountryCode("PL");
    setBankName("");
    setBankAccount("");
    setEmail("");
    setPhone("");
    setInvoicePattern("FV/{NNN}/{MM}/{RRRR}");
    setClientPortalEmail("");
    setMakeWebhookUrl("");
  };

  const handleSave = () => {
    if (!name.trim() || !nip.trim() || !ksefToken.trim() || !storagePath.trim()) return;
    const data = {
      name: name.trim(),
      nip: nip.trim(),
      ksefToken: ksefToken.trim(),
      storagePath: storagePath.trim(),
      street: street.trim() || null,
      city: city.trim() || null,
      postalCode: postalCode.trim() || null,
      countryCode: countryCode.trim() || "PL",
      bankName: bankName.trim() || null,
      bankAccount: bankAccount.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      invoicePattern: invoicePattern.trim() || "FV/{NNN}/{MM}/{RRRR}",
      clientPortalEmail: clientPortalEmail.trim() || null,
      makeWebhookUrl: makeWebhookUrl.trim() || null,
    };

    if (editingCompany) {
      updateMutation.mutate(
        { ...data, id: editingCompany.id },
        { onSuccess: () => isOnboarding && navigate("/dashboard") }
      );
    } else {
      addMutation.mutate(data, {
        onSuccess: () => {
          if (isOnboarding) navigate("/dashboard");
          else handleNewCompany();
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => handleNewCompany(),
    });
  };

  const isValid = name.trim() && nip.trim() && storagePath.trim() && (editingCompany || ksefToken.trim());
  const isSaving = addMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-panel border-b border-border/50 px-6 py-4 flex items-center gap-4">
        {!isOnboarding && (
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {isOnboarding ? "Witaj w KSeF Archiwum" : "Ustawienia firm"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOnboarding
              ? "Dodaj swoją pierwszą firmę, aby rozpocząć."
              : "Zarządzaj profilami firm i ich ustawieniami KSeF."}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 flex gap-6">
        {/* Company list (not shown in onboarding if no companies) */}
        {(!isOnboarding || (companies && companies.length > 0)) && (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-64 flex-shrink-0"
          >
            <div className="glass-panel-elevated rounded-2xl p-4">
              <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">
                Twoje firmy
              </h2>
              <div className="space-y-1 mb-3">
                {companies?.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleSelectCompany(company)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                      editingCompany?.id === company.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        editingCompany?.id === company.id
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {company.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-medium truncate text-sm">{company.name}</p>
                      <p
                        className={`text-xs ${
                          editingCompany?.id === company.id
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {company.nip}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {(companies?.length ?? 0) < 4 && (
                <Button
                  variant="ghost"
                  onClick={handleNewCompany}
                  className="w-full rounded-xl text-xs gap-2 justify-start"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nowa firma
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Form */}
        <div className="flex-1 space-y-6">
          {/* Nazwa firmy */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-panel-elevated rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Nazwa firmy</h2>
                <p className="text-xs text-muted-foreground">Nazwa wyświetlana w panelu</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="np. Firma Sp. z o.o."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </motion.div>

          {/* NIP firmy */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="glass-panel-elevated rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">NIP firmy</h2>
                <p className="text-xs text-muted-foreground">Numer identyfikacji podatkowej</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="np. 1234567890"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              maxLength={10}
              className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </motion.div>

          {/* Token KSeF */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel-elevated rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Token autoryzacji KSeF</h2>
                <p className="text-xs text-muted-foreground">Token autoryzacyjny z portalu KSeF</p>
              </div>
            </div>
            <input
              type="password"
              placeholder="Wprowadź token KSeF"
              value={ksefToken}
              onChange={(e) => setKsefToken(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </motion.div>

          {/* Ścieżka archiwum */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-panel-elevated rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <FolderOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Ścieżka archiwum</h2>
                <p className="text-xs text-muted-foreground">Ścieżka sieciowa do archiwum faktur</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="\\\\TB-AFS\\Archive"
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono text-xs"
            />
          </motion.div>

          {/* Adres firmy */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="glass-panel-elevated rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Adres firmy</h2>
                <p className="text-xs text-muted-foreground">Adres używany na wystawianych fakturach</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" placeholder="ul. Przykładowa 1" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              <input type="text" placeholder="Warszawa" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              <input type="text" placeholder="00-001" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" maxLength={6} />
              <input type="text" placeholder="PL" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" maxLength={2} />
            </div>
          </motion.div>

          {/* Dane bankowe */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="glass-panel-elevated rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Dane bankowe</h2>
                <p className="text-xs text-muted-foreground">Rachunek bankowy wyświetlany na fakturach</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" placeholder="Nazwa banku" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              <input type="text" placeholder="PL 00 0000 0000 0000 0000 0000 0000" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono text-xs" />
              <input type="email" placeholder="email@firma.pl" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              <input type="tel" placeholder="+48 000 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </motion.div>

          {/* E-mail portalu klienta */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="glass-panel-elevated rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">E-mail portalu klienta</h2>
                <p className="text-xs text-muted-foreground">Adres, na który jednym kliknięciem wyślesz fakturę</p>
              </div>
            </div>
            <input type="email" placeholder="portal@klient.pl" value={clientPortalEmail} onChange={(e) => setClientPortalEmail(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
          </motion.div>

          {/* URL Webhooka Make */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-panel-elevated rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Webhook className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Webhook Make (automatyzacja)</h2>
                <p className="text-xs text-muted-foreground">URL webhooka Make do automatycznej wysyłki faktur z PDF</p>
              </div>
            </div>
            <input type="url" placeholder="https://hook.eu2.make.com/..." value={makeWebhookUrl} onChange={(e) => setMakeWebhookUrl(e.target.value)} className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono text-xs" />
          </motion.div>

          {/* Wzorzec numeracji */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-panel-elevated rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Hash className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Wzorzec numeracji faktur</h2>
                <p className="text-xs text-muted-foreground">Zmienne: {"{NNN}"} numer, {"{MM}"} miesiąc, {"{RRRR}"} rok, {"{RR}"} rok skrócony</p>
              </div>
            </div>
            <input type="text" value={invoicePattern} onChange={(e) => setInvoicePattern(e.target.value)} placeholder="FV/{NNN}/{MM}/{RRRR}" className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono" />
          </motion.div>

          {/* Zarządzanie zespołem */}
          <TeamManagement />

          {/* Przyciski */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 pt-2"
          >
            <Button
              onClick={handleSave}
              disabled={!isValid || isSaving}
              className="rounded-xl px-6 gap-2 shadow-sm"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingCompany
                ? "Zapisz zmiany"
                : isOnboarding
                ? "Rozpocznij"
                : "Dodaj firmę"}
            </Button>

            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="rounded-xl px-5 gap-2"
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              Testuj bazę danych
            </Button>

            {editingCompany && (
              <Button
                variant="ghost"
                onClick={() => handleDelete(editingCompany.id)}
                disabled={deleteMutation.isPending}
                className="rounded-xl px-4 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Usuń firmę
              </Button>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
