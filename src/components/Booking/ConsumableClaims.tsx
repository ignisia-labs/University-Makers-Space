import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackageCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import {
  consumableClaimsApi,
  readableError,
  type ConsumableAllowance,
  type ConsumableClaimDto,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Claiming material during a session.
 *
 * The list is the project's *approved* materials, not the whole shelf: a team
 * may only take what its mentor signed off. Anything already collected — or
 * still waiting at the desk — is subtracted, and a material with nothing left
 * disappears from the claim list rather than inviting a request that would be
 * refused.
 */
export function ConsumableClaims({
  projectId,
  bookingId,
}: {
  projectId: string;
  bookingId: string;
}) {
  const queryClient = useQueryClient();

  const allowance = useQuery({
    queryKey: ["consumable-allowance", projectId],
    queryFn: () => consumableClaimsApi.allowance(projectId).then((r) => r.data),
    staleTime: 15_000,
  });
  const claims = useQuery({
    queryKey: ["consumable-claims", projectId],
    queryFn: () =>
      consumableClaimsApi.list({ projectId, limit: "50" }).then((response) => response.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["consumable-allowance", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["consumable-claims", projectId] });
  };

  const submit = useMutation({
    mutationFn: (input: { consumableId: string; quantity: number; variant: string | null }) =>
      consumableClaimsApi.create({
        projectId,
        bookingId,
        consumableId: input.consumableId,
        quantity: input.quantity,
        variant: input.variant,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Claim sent to the MakerSpace desk");
    },
    onError: (error) => toast.error(readableError(error, "That claim could not be sent")),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => consumableClaimsApi.cancel(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Claim withdrawn");
    },
    onError: (error) => toast.error(readableError(error, "That claim could not be withdrawn")),
  });

  if (allowance.isPending) {
    return <div className="h-20 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />;
  }
  const materials = allowance.data ?? [];
  if (materials.length === 0) return null;

  const claimable = materials.filter((item) => item.remainingQuantity > 0);
  const open = (claims.data ?? []).filter((claim) => claim.status === "PENDING");
  const settled = (claims.data ?? []).filter(
    (claim) => claim.status === "ISSUED" || claim.status === "REJECTED",
  );

  return (
    <section className="border-t border-border px-6 py-5 sm:px-8">
      <div className="flex items-center gap-2">
        <PackageCheck className="size-4 text-primary" aria-hidden />
        <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Materials</p>
      </div>

      {claimable.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {claimable.map((item) => (
            <ClaimRow
              key={item.consumableId}
              item={item}
              busy={submit.isPending}
              onClaim={(quantity, variant) =>
                submit.mutate({ consumableId: item.consumableId, quantity, variant })
              }
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Your team has claimed everything its plan approved.
        </p>
      )}

      {open.length > 0 && (
        <>
          <p className="mt-5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            At the desk
          </p>
          <ul className="mt-2 space-y-1.5">
            {open.map((claim) => (
              <li
                key={claim.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2"
              >
                <span className="text-xs">
                  <span className="font-medium">
                    {claim.quantity} {claim.unit} · {claim.name}
                  </span>
                  {claim.variant && (
                    <span className="text-muted-foreground"> · {claim.variant}</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge label={claim.statusLabel} />
                  <button
                    type="button"
                    disabled={withdraw.isPending}
                    onClick={() => withdraw.mutate(claim.id)}
                    className="text-[11px] font-semibold text-muted-foreground underline hover:text-foreground disabled:opacity-50"
                  >
                    Withdraw
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {settled.length > 0 && (
        <>
          <p className="mt-5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Collected
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {settled.map((claim) => (
              <ClaimChip key={claim.id} claim={claim} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ClaimRow({
  item,
  busy,
  onClaim,
}: {
  item: ConsumableAllowance;
  busy: boolean;
  onClaim: (quantity: number, variant: string | null) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState<string | null>(item.variant ?? item.variants[0] ?? null);
  // Never offer more than the plan allows, nor more than the shelf holds.
  const ceiling = Math.max(1, Math.min(item.remainingQuantity, item.stockQuantity));

  return (
    <li className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.name}</p>
          <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {item.remainingQuantity} of {item.approvedQuantity} {item.unit} left on your plan
            {item.stockQuantity <= item.remainingQuantity &&
              ` · ${item.stockQuantity} in the MakerSpace`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Fewer ${item.name}`}
            disabled={quantity <= 1}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-35"
          >
            −
          </button>
          <span className="w-8 text-center font-mono text-sm font-semibold text-primary">
            {quantity}
          </span>
          <button
            type="button"
            aria-label={`More ${item.name}`}
            disabled={quantity >= ceiling}
            onClick={() => setQuantity((current) => Math.min(ceiling, current + 1))}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-35"
          >
            +
          </button>
          <button
            type="button"
            disabled={busy || !item.claimable}
            onClick={() => onClaim(quantity, variant)}
            className="pressable ml-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-45"
          >
            {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
            Claim
          </button>
        </div>
      </div>

      {item.variants.length > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {item.variants.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === variant}
              onClick={() => setVariant(option)}
              className={cn(
                "min-h-8 rounded-full border px-3 text-[11px] font-medium transition-colors",
                option === variant
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {!item.claimable && item.stockQuantity === 0 && (
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          The MakerSpace has none of this left. Ask the desk when it is restocked.
        </p>
      )}
    </li>
  );
}

function ClaimChip({ claim }: { claim: ConsumableClaimDto }) {
  const issued = claim.status === "ISSUED";
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px]",
        issued
          ? "border-primary/20 bg-primary/[0.05] text-primary"
          : "border-border bg-muted text-muted-foreground",
      )}
      title={claim.decisionReason ?? undefined}
    >
      <span
        className={cn("size-1.5 rounded-full", issued ? "bg-primary" : "bg-muted-foreground/50")}
      />
      {claim.quantity} {claim.unit} · {claim.name}
      <span className="font-mono uppercase tracking-wider opacity-70">
        {issued ? "collected" : "declined"}
      </span>
    </li>
  );
}
