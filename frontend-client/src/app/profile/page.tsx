"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  HardDrive,
  Layers,
  Loader2,
  Network,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Btn,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PageShell,
  Panel,
  Pill,
  Spinner,
  inputClass,
} from "@/components/ui";
import {
  apiRequest,
  errorMessage,
  type BidderEntity,
  type NetworkTelemetryResponse,
  type UdyamVerificationResponse,
  type VendorProfileGetResponse,
  type VendorProfileSavePayload,
  type VendorProfileSaveResponse,
} from "@/lib/api";

const PRESET_UDYAMS = [
  { label: "Bharat Precision (TN)", id: "UDYAM-TN-02-0048192", defaultBidderId: "B001" },
  { label: "Kavach Cyber (DL)", id: "UDYAM-DL-01-0098765", defaultBidderId: "B002" },
  { label: "Sahyadri Infra (MH)", id: "UDYAM-MH-01-0012345", defaultBidderId: "B003" },
  { label: "Bengaluru IoT (KA)", id: "UDYAM-KA-03-0099999", defaultBidderId: "B004" },
  { label: "Southern Heavy (TN)", id: "UDYAM-TN-01-0012345", defaultBidderId: "B005" },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"setup" | "roster" | "statutory">("setup");

  // Udyam statutory search input
  const [udyamInput, setUdyamInput] = useState("UDYAM-TN-02-0048192");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form State (matching branches/Cartel-graph parameters)
  const [bidderId, setBidderId] = useState("B001");
  const [assignedTender, setAssignedTender] = useState("GEM/2026/B/9292805");
  const [bidPrice, setBidPrice] = useState("2,35,00,000");
  const [companyName, setCompanyName] = useState("");
  const [owners, setOwners] = useState<string[]>([]);
  const [newOwnerInput, setNewOwnerInput] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [bankRouting, setBankRouting] = useState("");
  const [bankName, setBankName] = useState("");
  const [assets, setAssets] = useState<string[]>([]);
  const [newAssetInput, setNewAssetInput] = useState("");

  // Verified Udyam Metadata
  const [udyamData, setUdyamData] = useState<UdyamVerificationResponse | null>(null);

  // Telemetry & Active Bidders Pool
  const [detectedTrueIp, setDetectedTrueIp] = useState<string>("Detecting...");
  const [ipTelemetry, setIpTelemetry] = useState<NetworkTelemetryResponse | null>(null);
  const [biddersRoster, setBiddersRoster] = useState<BidderEntity[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [searchRoster, setSearchRoster] = useState("");

  // 1. Fetch live client IP telemetry & existing roster
  const loadProfileAndRoster = useCallback(async () => {
    try {
      setLoadingProfile(true);
      const res = await apiRequest<VendorProfileGetResponse>("/api/udyam/profile");
      setDetectedTrueIp(res.data.detected_ip);
      setBiddersRoster(res.data.bidders || []);
      if (!ipAddress || ipAddress === "Detecting...") {
        setIpAddress(res.data.detected_ip);
      }
    } catch {
      setDetectedTrueIp("127.0.0.1 (Local Standby)");
      if (!ipAddress) setIpAddress("127.0.0.1");
    } finally {
      setLoadingProfile(false);
    }
  }, [ipAddress]);

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await apiRequest<NetworkTelemetryResponse>("/api/udyam/client-ip");
      setIpTelemetry(res.data);
      setDetectedTrueIp(res.data.ip);
    } catch {
      setDetectedTrueIp("127.0.0.1");
    }
  }, []);

  useEffect(() => {
    loadProfileAndRoster();
    fetchTelemetry();
  }, [loadProfileAndRoster, fetchTelemetry]);

  // 2. Verify Udyam Number via API and auto-populate form
  const handleVerifyUdyam = async (targetId?: string, targetBidderId?: string) => {
    const queryId = (targetId || udyamInput).trim().toUpperCase();
    if (!queryId) return;
    setVerifying(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const res = await apiRequest<UdyamVerificationResponse>(`/api/udyam/verify/${encodeURIComponent(queryId)}`);
      const data = res.data;
      setUdyamData(data);
      setCompanyName(data.company_name);
      setOwners(data.beneficial_owners || []);
      setBankRouting(data.bank_routing_code || "");
      setBankName(data.bank_name || "");

      if (targetBidderId) {
        setBidderId(targetBidderId);
      } else if (!bidderId || bidderId === "B001") {
        const parts = data.udyam_number.split("-");
        setBidderId(parts.length >= 4 ? `B${parts[1]}${parts[3].slice(-3)}` : "B001");
      }

      // Populate suggested assets if user has none
      if (assets.length === 0 && data.suggested_assets && data.suggested_assets.length > 0) {
        setAssets(data.suggested_assets);
      }

      setUdyamInput(data.udyam_number);
      setSuccessNotice(`Statutory credentials for '${data.company_name}' successfully extracted via official MSME API.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  // Initial auto-verification on mount
  useEffect(() => {
    handleVerifyUdyam("UDYAM-TN-02-0048192", "B001");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Add asset
  const handleAddAsset = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newAssetInput.trim().toUpperCase();
    if (!clean) return;
    if (!assets.includes(clean)) {
      setAssets([...assets, clean]);
    }
    setNewAssetInput("");
  };

  // 4. Remove asset
  const handleRemoveAsset = (item: string) => {
    setAssets(assets.filter((a) => a !== item));
  };

  // 5. Add owner
  const handleAddOwner = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newOwnerInput.trim();
    if (!clean) return;
    if (!owners.includes(clean)) {
      setOwners([...owners, clean]);
    }
    setNewOwnerInput("");
  };

  // 6. Remove owner
  const handleRemoveOwner = (item: string) => {
    setOwners(owners.filter((o) => o !== item));
  };

  // 7. Save Bidder to Cartel Graph analysis
  const handleSaveBidder = async () => {
    if (!bidderId.trim()) {
      setError("Please specify a Bidder Identifier (e.g. B001, B008).");
      return;
    }
    if (!companyName.trim()) {
      setError("Please enter or auto-extract a valid company name.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const payload: VendorProfileSavePayload = {
        udyam_number: udyamInput.trim().toUpperCase() || "UDYAM-GEN-00-0000000",
        bidder_id: bidderId.trim().toUpperCase(),
        tender_id: assignedTender.trim(),
        company_name: companyName.trim(),
        beneficial_owners: owners,
        declared_assets: assets,
        bank_routing_code: bankRouting.trim() || undefined,
        ip_address: ipAddress.trim() || detectedTrueIp,
        sector: udyamData?.sector || "Manufacturing",
        enterprise_type: udyamData?.enterprise_type || "Micro",
      };

      const res = await apiRequest<VendorProfileSaveResponse>("/api/udyam/profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setSuccessNotice(
        `Bidder ${res.data.bidder_id} ('${res.data.profile.name}') registered for Tender ${assignedTender}! IP ${res.data.detected_ip} & ${res.data.declared_assets_count} declared assets synced with Cartel Graph.`
      );
      await loadProfileAndRoster();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // 8. Delete Bidder from Cartel Graph pool
  const handleDeleteBidder = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await apiRequest(`/api/udyam/bidders/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setBiddersRoster((prev) => prev.filter((b) => b.bidder_id !== id));
      setSuccessNotice(`Bidder ${id} removed from Cartel Graph dataset.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  // 9. Quick Seed Dummy Test Network
  const handleSeedDummy = async () => {
    setError(null);
    try {
      const res = await apiRequest<{ message: string; count: number; bidders: BidderEntity[] }>("/api/udyam/seed-dummy", {
        method: "POST",
      });
      setBiddersRoster(res.data.bidders || []);
      setSuccessNotice(`Loaded ${res.data.count} dummy bidders with multi-hop collusion syndicates for testing.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // 10. Clear Cartel Pool (Reset to Blank)
  const handleClearPool = async () => {
    setError(null);
    try {
      await apiRequest("/api/udyam/clear-pool", { method: "POST" });
      setBiddersRoster([]);
      setSuccessNotice("Cartel Graph dataset reset to blank.");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // 11. Real-time Collusion Pre-flight Radar (Scoped to current tender)
  // Checks if the current form inputs overlap with any registered bidder in the pool for this tender
  const collusionOverlap = useMemo(() => {
    const currentId = bidderId.trim().toUpperCase();
    const otherBidders = biddersRoster.filter(
      (b) => b.bidder_id !== currentId && (!b.tender_id || b.tender_id === assignedTender)
    );
    if (otherBidders.length === 0) return null;

    const conflicts: { type: string; value: string; otherId: string; otherName: string }[] = [];

    // Check IP
    const cleanIp = ipAddress.trim();
    if (cleanIp && cleanIp !== "127.0.0.1" && cleanIp !== "localhost") {
      otherBidders.forEach((b) => {
        if (b.submission_metadata?.ip_address === cleanIp) {
          conflicts.push({
            type: "Submission IP Fingerprint",
            value: cleanIp,
            otherId: b.bidder_id,
            otherName: b.name,
          });
        }
      });
    }

    // Check Bank Routing
    const cleanBank = bankRouting.trim();
    if (cleanBank) {
      otherBidders.forEach((b) => {
        if (b.submission_metadata?.bank_routing_code === cleanBank) {
          conflicts.push({
            type: "Settlement Routing Code",
            value: cleanBank,
            otherId: b.bidder_id,
            otherName: b.name,
          });
        }
      });
    }

    // Check Owners
    owners.forEach((owner) => {
      const oClean = owner.trim().toLowerCase();
      if (!oClean) return;
      otherBidders.forEach((b) => {
        (b.beneficial_owners || []).forEach((bo) => {
          if (bo.name && bo.name.trim().toLowerCase() === oClean) {
            conflicts.push({
              type: "Beneficial Owner / Director",
              value: owner,
              otherId: b.bidder_id,
              otherName: b.name,
            });
          }
        });
      });
    });

    // Check Assets
    assets.forEach((asset) => {
      const aClean = asset.trim().toUpperCase();
      if (!aClean) return;
      otherBidders.forEach((b) => {
        (b.declared_assets || []).forEach((da) => {
          if (da.trim().toUpperCase() === aClean) {
            conflicts.push({
              type: "Declared Asset / Machinery Serial",
              value: asset,
              otherId: b.bidder_id,
              otherName: b.name,
            });
          }
        });
      });
    });

    return conflicts;
  }, [bidderId, ipAddress, bankRouting, owners, assets, biddersRoster]);

  const filteredRoster = useMemo(() => {
    if (!searchRoster.trim()) return biddersRoster;
    const q = searchRoster.toLowerCase();
    return biddersRoster.filter(
      (b) =>
        b.bidder_id.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.submission_metadata?.ip_address && b.submission_metadata.ip_address.toLowerCase().includes(q)) ||
        (b.submission_metadata?.bank_routing_code && b.submission_metadata.bank_routing_code.toLowerCase().includes(q))
    );
  }, [biddersRoster, searchRoster]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="MSME Sovereign Identity & Cartel Graph Ingestion"
        title="Enterprise Profile & Cartel Graph Setup"
        subtitle="Extract statutory enterprise credentials from Udyam, declare equipment serials, and configure metadata for the Cartel & Collusion Bipartite Graph."
        statutes={[
          "MSMED Act 2006 §8",
          "Competition Act 2002 §3(3)(d)",
          "GeM Rule 149 (Integrity Telemetry)",
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSeedDummy}
              className="flex items-center gap-1.5 rounded border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 transition"
              title="Populate 8 standardized test bidders with multi-hop collusion syndicates"
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span>Seed Dummy Network (8)</span>
            </button>

            <button
              type="button"
              onClick={handleClearPool}
              className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
              title="Reset dataset to blank"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Reset Blank</span>
            </button>

            <a
              href="http://localhost:3001/cartel-graph"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
              title="Open Live Cartel Graph on Admin Portal (:3001)"
            >
              <Network className="h-4 w-4" />
              <span>View Cartel Graph (:3001)</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <Btn
              variant="primary"
              onClick={handleSaveBidder}
              disabled={saving}
              icon={saving ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
            >
              {saving ? "Saving..." : "Save Bidder to Analysis"}
            </Btn>
          </div>
        }
      />

      {error && <ErrorNotice message={error} onRetry={() => setError(null)} />}

      {successNotice && (
        <div className="flex items-center gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div className="flex-1 leading-relaxed">{successNotice}</div>
        </div>
      )}

      {/* KPI & Live Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-md border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
            <span>True Network IP</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-2 text-lg font-mono font-bold text-slate-100 truncate">{detectedTrueIp}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400">
            <Globe className="h-3 w-3" />
            <span>Captured from Client Socket</span>
          </div>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
            <span>Active Cartel Pool</span>
            <Network className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-100">
            {biddersRoster.length} Registered Bidder{biddersRoster.length === 1 ? "" : "s"}
          </div>
          <div className="mt-1 text-[11px] text-sky-400">Synced across Main & Branch</div>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
            <span>Declared Equipment</span>
            <Cpu className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-100">{assets.length} Units</div>
          <div className="mt-1 text-[11px] text-violet-400">Machinery Serials Registered</div>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
            <span>Pre-flight Collusion Radar</span>
            {collusionOverlap && collusionOverlap.length > 0 ? (
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            )}
          </div>
          <div
            className={`mt-2 text-lg font-bold ${
              collusionOverlap && collusionOverlap.length > 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {collusionOverlap && collusionOverlap.length > 0 ? "Overlap Flagged" : "Clean Footprint"}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {collusionOverlap && collusionOverlap.length > 0
              ? `${collusionOverlap.length} shared link(s) detected`
              : "Zero shared infrastructure"}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("setup")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === "setup"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Cartel Graph Ingestion Form</span>
        </button>
        <button
          onClick={() => setActiveTab("roster")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === "roster"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Active Bidders Roster ({biddersRoster.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("statutory")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === "statutory"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Statutory MSME Seal & Statutes</span>
        </button>
      </div>

      {/* TAB 1: CARTEL GRAPH INGESTION FORM */}
      {activeTab === "setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT COLUMN: Udyam Auto-Extractor & Form (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Step 1: Statutory Udyam Ingestion */}
            <Panel
              title="1. Statutory Udyam Auto-Extraction"
              subtitle="Connects to the MSME Statutory Registry. Enter any statutory Udyam number to extract verified enterprise name, owners, sector, and routing."
            >
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1.5">
                    Statutory Udyam Registration Number (MSMED Act 2006 §8)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={udyamInput}
                      onChange={(e) => setUdyamInput(e.target.value.toUpperCase())}
                      placeholder="e.g. UDYAM-TN-02-0048192"
                      className={`${inputClass} font-mono tracking-wide uppercase text-slate-100`}
                    />
                    <Btn
                      variant="primary"
                      onClick={() => handleVerifyUdyam()}
                      disabled={verifying}
                      icon={verifying ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
                    >
                      {verifying ? "Extracting..." : "Verify & Extract"}
                    </Btn>
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5">Instant Verification Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_UDYAMS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setUdyamInput(p.id);
                          handleVerifyUdyam(p.id, p.defaultBidderId);
                        }}
                        className="rounded border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:border-sky-500 hover:bg-slate-700 transition"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            {/* Step 2: The 6 Core Cartel Graph Parameters (Matching branches/Cartel-graph) */}
            <Panel
              title="2. Cartel Graph Parameters (D:\\fed-learning\\branches\\Cartel-graph)"
              subtitle="Configure the 6 exact metadata attributes evaluated by the Bipartite Graph Force Simulation."
            >
              <div className="space-y-4 text-xs">
                {/* Target Tender Selection & Quoted Bid */}
                <div className="rounded border border-sky-500/30 bg-sky-950/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-sky-300">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-sky-400" />
                      Active Tender Bidding Assignment
                    </span>
                    <span className="rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] px-2 py-0.5">
                      Per-Tender Isolation
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">
                        Currently Bidding on Tender <span className="text-sky-400">*</span>
                      </label>
                      <select
                        value={assignedTender}
                        onChange={(e) => setAssignedTender(e.target.value)}
                        className={`${inputClass} font-mono text-sky-300 bg-slate-900 border-sky-500/40`}
                      >
                        <option value="GEM/2026/B/9292805">GEM/2026/B/9292805 (Naval CNC Rig)</option>
                        <option value="T2001">T2001 (Railways Signaling Infra)</option>
                        <option value="T2003">T2003 (Grid Power Transformers)</option>
                      </select>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Collusion graph only checks competitors in this tender.
                      </span>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-300 mb-1">
                        Quoted Bid Price (INR)
                      </label>
                      <input
                        type="text"
                        value={bidPrice}
                        onChange={(e) => setBidPrice(e.target.value)}
                        placeholder="e.g. 2,35,00,000"
                        className={`${inputClass} font-mono text-slate-200`}
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Commercial proposal price submitted.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      Bidder ID <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={bidderId}
                      onChange={(e) => setBidderId(e.target.value.toUpperCase())}
                      placeholder="e.g. B001, B008"
                      className={`${inputClass} font-mono font-bold uppercase text-emerald-400`}
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Primary graph node key in bipartite network.
                    </span>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      Company Name <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Bharat Precision Engineering Pvt Ltd"
                      className={`${inputClass} font-semibold text-slate-100`}
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Auto-extracted from statutory registry.
                    </span>
                  </div>
                </div>

                {/* Beneficial Owners / Directors */}
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Beneficial Owners / Designated Directors
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {owners.length === 0 ? (
                      <span className="text-slate-500 italic text-[11px]">No owners registered yet.</span>
                    ) : (
                      owners.map((owner) => (
                        <span
                          key={owner}
                          className="inline-flex items-center gap-1.5 rounded bg-slate-800 border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200"
                        >
                          <UserCheck className="h-3 w-3 text-emerald-400" />
                          <span>{owner}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveOwner(owner)}
                            className="text-slate-400 hover:text-rose-400 ml-1 font-bold"
                            title="Remove owner"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newOwnerInput}
                      onChange={(e) => setNewOwnerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOwner();
                        }
                      }}
                      placeholder="Add owner name (e.g. Rajesh Kumar Sharma)"
                      className={`${inputClass} text-xs py-1.5`}
                    />
                    <Btn variant="secondary" onClick={() => handleAddOwner()} icon={<Plus className="h-3.5 w-3.5" />}>
                      Add
                    </Btn>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* IP Address */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-medium text-slate-300">Submission IP Address</label>
                      <button
                        type="button"
                        onClick={() => setIpAddress(detectedTrueIp)}
                        className="text-[10.5px] text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        <span>Use True Detected IP</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="e.g. 103.21.58.12 or 203.0.113.5"
                      className={`${inputClass} font-mono`}
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      Detected: <span className="font-mono text-slate-400">{detectedTrueIp}</span>
                    </span>
                  </div>

                  {/* Bank Routing Code */}
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Bank Routing Code / IFSC</label>
                    <input
                      type="text"
                      value={bankRouting}
                      onChange={(e) => setBankRouting(e.target.value.trim())}
                      placeholder="e.g. 021000021"
                      className={`${inputClass} font-mono`}
                    />
                    <span className="text-[10.5px] text-slate-500 mt-1 block">
                      {bankName ? bankName : "9-digit settlement routing identifier."}
                    </span>
                  </div>
                </div>

                {/* Declared Assets / Machinery */}
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Declared Assets / Machinery Serials
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {assets.length === 0 ? (
                      <span className="text-slate-500 italic text-[11px]">No machinery serials declared.</span>
                    ) : (
                      assets.map((asset) => (
                        <span
                          key={asset}
                          className="inline-flex items-center gap-1.5 rounded bg-violet-950/60 border border-violet-800/80 px-2.5 py-1 text-[11px] text-violet-200 font-mono"
                        >
                          <Cpu className="h-3 w-3 text-violet-400" />
                          <span>{asset}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAsset(asset)}
                            className="text-violet-400 hover:text-rose-400 ml-1 font-bold"
                            title="Remove asset"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAssetInput}
                      onChange={(e) => setNewAssetInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddAsset();
                        }
                      }}
                      placeholder="Add asset serial (e.g. ASSET-CNC-801, ASSET-LATHE-204)"
                      className={`${inputClass} font-mono uppercase text-xs py-1.5`}
                    />
                    <Btn variant="secondary" onClick={() => handleAddAsset()} icon={<Plus className="h-3.5 w-3.5" />}>
                      Add
                    </Btn>
                  </div>
                  {udyamData?.suggested_assets && udyamData.suggested_assets.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-slate-500">Suggested:</span>
                      {udyamData.suggested_assets.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            if (!assets.includes(s)) setAssets([...assets, s]);
                          }}
                          className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10.5px] text-slate-400 hover:border-violet-500 hover:text-slate-200 transition"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <Btn
                    variant="primary"
                    className="w-full justify-center py-2.5"
                    onClick={handleSaveBidder}
                    disabled={saving}
                    icon={saving ? <Spinner /> : <Upload className="h-4 w-4" />}
                  >
                    {saving ? "Saving to Cartel Analysis..." : "Save Bidder to Analysis"}
                  </Btn>
                </div>
              </div>
            </Panel>
          </div>

          {/* RIGHT COLUMN: Real-Time Radar & Active Roster Mini-View (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Live Collusion Pre-flight Radar */}
            <div
              className={`rounded-md border p-4 space-y-3 ${
                collusionOverlap && collusionOverlap.length > 0
                  ? "border-rose-500/40 bg-rose-950/20"
                  : "border-emerald-500/40 bg-emerald-950/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                  {collusionOverlap && collusionOverlap.length > 0 ? (
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  )}
                  Real-Time Collusion Radar
                </span>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                    collusionOverlap && collusionOverlap.length > 0
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {collusionOverlap && collusionOverlap.length > 0 ? "COLLUSION DETECTED" : "CLEAN INDEPENDENT"}
                </span>
              </div>

              {collusionOverlap && collusionOverlap.length > 0 ? (
                <div className="space-y-2 text-xs">
                  <p className="text-rose-200">
                    This entity shares infrastructure with another bidder in the cartel pool. Under Competition Act
                    §3(3)(d), this will trigger bipartite graph edge flags:
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {collusionOverlap.map((c, i) => (
                      <div
                        key={i}
                        className="rounded border border-rose-500/30 bg-rose-900/30 p-2 text-[11px] space-y-1"
                      >
                        <div className="flex items-center justify-between font-mono text-rose-300">
                          <span className="font-bold">{c.type}</span>
                          <span className="rounded bg-rose-950 px-1.5 py-0.5 text-rose-400">
                            Shares with {c.otherId}
                          </span>
                        </div>
                        <div className="text-slate-300">
                          Matched Value: <span className="font-mono text-white font-semibold">{c.value}</span>
                        </div>
                        <div className="text-slate-400 text-[10px]">Entity: {c.otherName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-emerald-200/90 leading-relaxed">
                  No overlapping IP address, beneficial owners, routing codes, or machinery serials detected against
                  the current cartel database. This entity has a verified independent footprint.
                </div>
              )}
            </div>

            {/* Active Bidders Roster Preview (matching branches/Cartel-graph side card) */}
            <Panel
              title={`Active Bidders (${biddersRoster.length})`}
              subtitle="Registered entities in the Cartel Graph dataset."
              actions={
                <button
                  onClick={loadProfileAndRoster}
                  className="text-slate-400 hover:text-slate-200 p-1 rounded"
                  title="Refresh roster"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              }
            >
              <div className="space-y-3 text-xs">
                {biddersRoster.length === 0 ? (
                  <div className="rounded border border-dashed border-slate-800 p-6 text-center text-slate-500">
                    <p className="font-medium text-slate-400">Cartel Graph Dataset is Blank</p>
                    <p className="text-[11px] mt-1">
                      No synthetic entities hardcoded. Add bidders using the form to populate live analysis.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {biddersRoster.map((b) => (
                      <div
                        key={b.bidder_id}
                        className="rounded border border-slate-800 bg-slate-900/70 p-2.5 space-y-1.5 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10.5px] px-1.5 py-0.5">
                              {b.bidder_id}
                            </span>
                            <span className="font-semibold text-slate-200 truncate max-w-[200px]">{b.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteBidder(b.bidder_id)}
                            disabled={deletingId === b.bidder_id}
                            className="text-slate-500 hover:text-rose-400 transition"
                            title={`Remove ${b.bidder_id} from graph`}
                          >
                            {deletingId === b.bidder_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[10.5px] text-slate-400 pt-1 border-t border-slate-800/80">
                          <div>
                            <span className="text-slate-500">IP:</span>{" "}
                            <span className="font-mono text-slate-300">
                              {b.submission_metadata?.ip_address || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Routing:</span>{" "}
                            <span className="font-mono text-slate-300">
                              {b.submission_metadata?.bank_routing_code || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Owners:</span>{" "}
                            <span className="text-slate-300">
                              {(b.beneficial_owners || []).map((o) => o.name).join(", ") || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Assets:</span>{" "}
                            <span className="font-mono text-slate-300">
                              {(b.declared_assets || []).length} units
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Storage: Cartel-graph/data/bidders.csv</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("roster")}
                    className="text-emerald-400 hover:underline font-semibold"
                  >
                    View Full Table →
                  </button>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE BIDDERS ROSTER FULL TABLE */}
      {activeTab === "roster" && (
        <div className="space-y-4">
          <Panel
            title={`Active Cartel Detection Pool (${biddersRoster.length} Entities)`}
            subtitle="Complete registry of bidders evaluated in the Cartel & Collusion Bipartite Network. Live data syncs directly with the D3 graph visualizer."
            actions={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchRoster}
                    onChange={(e) => setSearchRoster(e.target.value)}
                    placeholder="Search by ID, name, IP, routing..."
                    className={`${inputClass} pl-8 text-xs py-1.5 w-64`}
                  />
                </div>
                <Btn variant="secondary" onClick={loadProfileAndRoster} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                  Refresh
                </Btn>
              </div>
            }
          >
            {filteredRoster.length === 0 ? (
              <div className="rounded border border-dashed border-slate-800 p-12 text-center text-slate-500">
                <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-300">No bidders match criteria</p>
                <p className="text-xs text-slate-500 mt-1">
                  The dataset currently has {biddersRoster.length} entities. Add bidders via the Ingestion Form.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/80 font-mono text-[11px] text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Bidder ID</th>
                      <th className="p-3">Company Name</th>
                      <th className="p-3">Tender</th>
                      <th className="p-3">Submission IP</th>
                      <th className="p-3">Settlement Routing</th>
                      <th className="p-3">Beneficial Owners</th>
                      <th className="p-3">Declared Assets</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredRoster.map((b) => (
                      <tr key={b.bidder_id} className="hover:bg-slate-900/40 transition">
                        <td className="p-3">
                          <span className="rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs px-2 py-0.5">
                            {b.bidder_id}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-200">{b.name}</td>
                        <td className="p-3 font-mono text-xs">
                          {b.tender_id ? (
                            <span className="rounded bg-sky-500/20 text-sky-300 px-1.5 py-0.5 font-bold">
                              {b.tender_id}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10.5px]">Global / All</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-300">
                          {b.submission_metadata?.ip_address ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Globe className="h-3 w-3 text-emerald-400" />
                              {b.submission_metadata.ip_address}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-300">
                          {b.submission_metadata?.bank_routing_code || "—"}
                        </td>
                        <td className="p-3 text-slate-300">
                          {(b.beneficial_owners || []).map((o) => o.name).join(", ") || "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {(b.declared_assets || []).length === 0 ? (
                              <span className="text-slate-500 italic text-[11px]">None</span>
                            ) : (
                              (b.declared_assets || []).map((da) => (
                                <span
                                  key={da}
                                  className="rounded bg-violet-950/60 border border-violet-800/60 px-1.5 py-0.5 font-mono text-[10px] text-violet-300"
                                >
                                  {da}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteBidder(b.bidder_id)}
                            disabled={deletingId === b.bidder_id}
                            className="rounded p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition"
                            title={`Remove ${b.bidder_id}`}
                          >
                            {deletingId === b.bidder_id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* TAB 3: STATUTORY MSME SEAL & STATUTES */}
      {activeTab === "statutory" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-5">
            <Panel
              title="Official MSME Statutory Seal & Legal Verification"
              subtitle="Statutory cryptographic proof of registration under Ministry of Micro, Small and Medium Enterprises."
            >
              {udyamData ? (
                <div className="space-y-4 text-xs">
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                        <div>
                          <div className="text-sm font-bold text-slate-100">{udyamData.company_name}</div>
                          <div className="font-mono text-emerald-400 text-xs">{udyamData.udyam_number}</div>
                        </div>
                      </div>
                      <span className="rounded bg-emerald-500/20 px-2.5 py-1 font-mono text-xs font-bold text-emerald-300">
                        {udyamData.verification_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                      <div>
                        <span className="text-slate-500 block">Enterprise Classification:</span>
                        <span className="font-semibold">{udyamData.enterprise_type} ({udyamData.major_activity})</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Statutory Authority Reference:</span>
                        <span className="font-semibold">{udyamData.statute_ref}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Jurisdiction:</span>
                        <span>{udyamData.state} · {udyamData.district}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">NIC Industry Classification:</span>
                        <span className="font-mono text-[11px]">{udyamData.nic_code}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">GSTIN:</span>
                        <span className="font-mono">{udyamData.gstin || "On File"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Permanent Account Number (PAN):</span>
                        <span className="font-mono">{udyamData.pan || "On File"}</span>
                      </div>
                    </div>

                    <div className="border-t border-emerald-500/20 pt-3 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
                      <span>Digital Seal: {udyamData.digital_seal}</span>
                      <span>Verified At: {new Date(udyamData.verified_at).toUTCString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Verify an Udyam number in the setup tab to display official statutory credentials.
                </div>
              )}
            </Panel>
          </div>

          <div className="lg:col-span-4 space-y-5">
            <Panel title="Cartel Graph Statutory Rules" subtitle="Statutory framework governing procurement integrity.">
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <div className="font-semibold text-emerald-400 mb-1">Competition Act 2002 §3(3)(d)</div>
                  <p className="text-slate-400 text-[11px]">
                    Prohibits bid rigging, collusive tendering, and sharing of settlement infrastructure, directors, or equipment serials across competitive tender bids.
                  </p>
                </div>

                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <div className="font-semibold text-sky-400 mb-1">MSMED Act 2006 §8</div>
                  <p className="text-slate-400 text-[11px]">
                    Mandates filing of statutory Udyam memorandum and empowers public procurement preferences under Public Procurement Policy for MSEs Order 2012.
                  </p>
                </div>

                <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                  <div className="font-semibold text-violet-400 mb-1">GeM Rule 149 Telemetry</div>
                  <p className="text-slate-400 text-[11px]">
                    Requires capturing true client IP sockets and machinery serial numbers during bid submission to prevent proxy bidding by cartel syndicates.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </PageShell>
  );
}
