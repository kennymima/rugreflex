"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Advertisement = {
  id: number;
  token_name: string;
  token_symbol: string | null;
  token_address: string | null;
  logo: string | null;
  description: string | null;
  status: string;
  package_id: number | null;
  currency: string | null;
  amount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  payment_record_id: number | null;
  created_at: string;
};

type AdPackage = {
  id: number;
  name: string;
  duration_days: number;
  price_usdc: number;
  active: boolean;
};

type AdvertisingContextValue = {
  adsEnabled: boolean;
  adsLoading: boolean;
  paymentsEnabled: boolean;
  usdcEnabled: boolean;
  rflxEnabled: boolean;
  rflxDiscountPercent: number;
  activeAdvertisements: Advertisement[];
  advertisements: Advertisement[];
  packages: AdPackage[];
  refreshAdvertisingData: () => Promise<void>;
};

const AdvertisingContext = createContext<AdvertisingContextValue | null>(null);

export function AdvertisingProvider({ children }: { children: ReactNode }) {
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [adsLoading, setAdsLoading] = useState(true);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [usdcEnabled, setUsdcEnabled] = useState(false);
  const [rflxEnabled, setRflxEnabled] = useState(false);
  const [rflxDiscountPercent, setRflxDiscountPercent] = useState(0);
  const [activeAdvertisements, setActiveAdvertisements] = useState<
    Advertisement[]
  >([]);
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [packages, setPackages] = useState<AdPackage[]>([]);

  const refreshAdvertisingData = useCallback(async () => {
    setAdsLoading(true);

    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("/api/advertisements", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || "Unable to load advertising configuration."
          );
        }

        setAdsEnabled(data?.ads_enabled === true);
        setPaymentsEnabled(data?.payments_enabled === true);
        setUsdcEnabled(data?.usdc_enabled === true);
        setRflxEnabled(data?.rflx_enabled === true);
        setRflxDiscountPercent(Number(data?.rflx_discount_percent ?? 0));
        setActiveAdvertisements(data?.activeAdvertisements || []);
        setAdvertisements(data?.advertisements || []);
        setPackages(data?.packages || []);

        setAdsLoading(false);
        return;
      } catch (error) {
        lastError = error;

        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    console.error(
      "Advertising configuration failed to load:",
      lastError
    );

    setAdsEnabled(false);
    setPaymentsEnabled(false);
    setUsdcEnabled(false);
    setRflxEnabled(false);
    setRflxDiscountPercent(0);
    setActiveAdvertisements([]);
    setAdvertisements([]);
    setPackages([]);
    setAdsLoading(false);
  }, []);

  useEffect(() => {
    void refreshAdvertisingData();
  }, [refreshAdvertisingData]);

  return (
    <AdvertisingContext.Provider
      value={{
        adsEnabled,
        adsLoading,
        paymentsEnabled,
        usdcEnabled,
        rflxEnabled,
        rflxDiscountPercent,
        activeAdvertisements,
        advertisements,
        packages,
        refreshAdvertisingData,
      }}
    >
      {children}
    </AdvertisingContext.Provider>
  );
}

export function useAdvertising() {
  const context = useContext(AdvertisingContext);

  if (!context) {
    throw new Error(
      "useAdvertising must be used within an AdvertisingProvider"
    );
  }

  return context;
}
