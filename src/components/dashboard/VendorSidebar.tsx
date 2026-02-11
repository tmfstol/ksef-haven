import { Building2, Search } from "lucide-react";
import { useState } from "react";
import type { Vendor } from "@/types/invoice";
import { motion, AnimatePresence } from "framer-motion";

interface VendorSidebarProps {
  vendors: Vendor[];
  selectedNip: string | null;
  onSelectVendor: (nip: string | null) => void;
}

export function VendorSidebar({ vendors, selectedNip, onSelectVendor }: VendorSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.nip.includes(search)
  );

  return (
    <aside className="w-72 flex-shrink-0 glass-panel border-r border-border/50 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-border/50">
        <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase mb-3">
          Vendors
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/60 border-0 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>

      {/* Vendor List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <button
          onClick={() => onSelectVendor(null)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mb-1 ${
            selectedNip === null
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-foreground hover:bg-secondary/80"
          }`}
        >
          <Building2 className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">All Vendors</span>
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
            selectedNip === null
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-secondary text-muted-foreground"
          }`}>
            {vendors.reduce((sum, v) => sum + v.invoiceCount, 0)}
          </span>
        </button>

        <AnimatePresence>
          {filtered.map((vendor) => (
            <motion.button
              key={vendor.nip}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              onClick={() => onSelectVendor(vendor.nip)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 mb-0.5 ${
                selectedNip === vendor.nip
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-secondary/80"
              }`}
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                selectedNip === vendor.nip
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-accent/10 text-accent"
              }`}>
                {vendor.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium truncate">{vendor.name}</p>
                <p className={`text-xs ${
                  selectedNip === vendor.nip
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                }`}>
                  NIP: {vendor.nip}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                selectedNip === vendor.nip
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {vendor.invoiceCount}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </aside>
  );
}
