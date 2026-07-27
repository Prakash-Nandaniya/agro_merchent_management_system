import { useQuery } from '@tanstack/react-query';
import { FetchInvoices, FetchTrades, FetchProfile } from "@/utils/cachestorage";
import { useContext, useEffect } from 'react';
import { ErrorContext } from '@/components/errors/errorcontext';
import OpaqueLoading from "@/components/opaqueloading/loading";

export default function GlobalDataLoader({ children }: { children: React.ReactNode }) {
    const errorcontext = useContext(ErrorContext);

    const invoices = useQuery({
        queryKey: ['Invoices'],
        queryFn: FetchInvoices,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });

    const trades = useQuery({
        queryKey: ['Trades'],
        queryFn: FetchTrades,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });

    const profile = useQuery({
        queryKey: ['Profile'],
        queryFn: FetchProfile,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
    
    const isLoading = invoices.isLoading || trades.isLoading || profile.isLoading;
    const isError = invoices.isError || trades.isError || profile.isError;

    useEffect(() => {
        if (isError && errorcontext) {
            const message = invoices.error?.message || trades.error?.message || profile.error?.message || 'Failed to load data.';
            errorcontext.addError(message);
        }
    }, [isError, errorcontext, invoices.error, trades.error, profile.error]);

    if (isLoading) {
        return <OpaqueLoading />;
    }

    if (isError) {
        return <div className="text-center p-10">Unable to load application data.</div>;
    }

    return <>{children}</>;
}