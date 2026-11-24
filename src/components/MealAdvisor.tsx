import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChefHat, Moon, RefreshCw, Sun, Utensils } from 'lucide-react';
import { Account, Transaction } from '../types/finance';
import { formatVND } from '../utils/format';

interface MealAdvisorProps {
  todayAllowance: number;
  todayTransactions?: Transaction[];
  accounts?: Account[];
  onSelectMeal: (mealName: string, price: number, accountId?: string) => void;
}

type MealSlot = 'breakfast' | 'lunch' | 'dinner';

interface MealItem {
  id: string;
  name: string;
  price: number;
  type: MealSlot;
  tag: string;
}

const ALL_MEALS: MealItem[] = [
  // Bữa sáng
  { id: 'b1', name: 'Bánh mì ốp la pate', price: 20000, type: 'breakfast', tag: 'Nhanh gọn' },
  { id: 'b2', name: 'Xôi mặn chả lụa', price: 20000, type: 'breakfast', tag: 'No lâu' },
  { id: 'b3', name: 'Phở bò tái lăn', price: 40000, type: 'breakfast', tag: 'Chất lượng' },
  { id: 'b4', name: 'Bún bò Huế sáng', price: 35000, type: 'breakfast', tag: 'Đậm đà' },
  { id: 'b5', name: 'Bánh cuốn nóng chả lụa', price: 25000, type: 'breakfast', tag: 'Thanh đạm' },
  { id: 'b6', name: 'Bánh bao nhân thịt trứng cút', price: 18000, type: 'breakfast', tag: 'Tiết kiệm' },
  { id: 'b7', name: 'Mì tôm 2 trứng rau cải', price: 15000, type: 'breakfast', tag: 'Tự nấu' },

  // Bữa trưa
  { id: 'l1', name: 'Cơm tấm sườn bì chả', price: 40000, type: 'lunch', tag: 'Quen thuộc' },
  { id: 'l2', name: 'Cơm văn phòng 1 mặn 2 rau', price: 35000, type: 'lunch', tag: 'Cân bằng' },
  { id: 'l3', name: 'Bún chả Hà Nội', price: 45000, type: 'lunch', tag: 'Hấp dẫn' },
  { id: 'l4', name: 'Bún đậu mắm tôm', price: 40000, type: 'lunch', tag: 'Khoái khẩu' },
  { id: 'l5', name: 'Cơm gà xối mỡ', price: 42000, type: 'lunch', tag: 'No nê' },
  { id: 'l6', name: 'Bún riêu cua ốc bò', price: 35000, type: 'lunch', tag: 'Dễ ăn' },
  { id: 'l7', name: 'Cơm bình dân tự chọn', price: 30000, type: 'lunch', tag: 'Tiết kiệm' },
  { id: 'l8', name: 'Cơm Bento cá thu Nhật', price: 65000, type: 'lunch', tag: 'Cao cấp' },

  // Bữa tối
  { id: 'd1', name: 'Tự nấu: Thịt kho + canh cải', price: 35000, type: 'dinner', tag: 'Tự nấu' },
  { id: 'd2', name: 'Hủ tiếu Nam Vang', price: 40000, type: 'dinner', tag: 'Ấm bụng' },
  { id: 'd3', name: 'Bún bò tái nạm', price: 45000, type: 'dinner', tag: 'Ngon miệng' },
  { id: 'd4', name: 'Mì cay hải sản', price: 50000, type: 'dinner', tag: 'Đổi vị' },
  { id: 'd5', name: 'Cháo sườn quẩy', price: 30000, type: 'dinner', tag: 'Nhẹ bụng' },
  { id: 'd6', name: 'Tự nấu: Canh sườn + đậu sốt', price: 40000, type: 'dinner', tag: 'Cơm nhà' },
  { id: 'd7', name: 'Bò né bánh mì tiêu đen', price: 55000, type: 'dinner', tag: 'Thưởng thức' },
  { id: 'd8', name: 'Lẩu 1 người kim chi bò', price: 79000, type: 'dinner', tag: 'Cuối tuần' },
];

export const MealAdvisor: React.FC<MealAdvisorProps> = ({
  todayAllowance,
  todayTransactions = [],
  accounts = [],
  onSelectMeal,
}) => {
  const [randomSeed, setRandomSeed] = useState(0);
  const [eatenSlots, setEatenSlots] = useState<Partial<Record<MealSlot, MealItem>>>({});

  const spendingWallets = useMemo(
    () => accounts.filter((a) => a.type !== 'savings'),
    [accounts]
  );

  const bestDefaultWalletId = useMemo(() => {
    if (spendingWallets.length === 0) return '';
    const funded = [...spendingWallets].sort((a, b) => b.balance - a.balance)[0];
    return funded?.id || spendingWallets[0].id;
  }, [spendingWallets]);

  const [selectedWalletId, setSelectedWalletId] = useState<string>(bestDefaultWalletId);

  useEffect(() => {
    if (!selectedWalletId || !spendingWallets.some((w) => w.id === selectedWalletId)) {
      setSelectedWalletId(bestDefaultWalletId);
    } else {
      const current = spendingWallets.find((w) => w.id === selectedWalletId);
      if (current && current.balance <= 0 && bestDefaultWalletId && bestDefaultWalletId !== selectedWalletId) {
        const best = spendingWallets.find((w) => w.id === bestDefaultWalletId);
        if (best && best.balance > 0) {
          setSelectedWalletId(bestDefaultWalletId);
        }
      }
    }
  }, [spendingWallets, bestDefaultWalletId, selectedWalletId]);

  const effectiveBudget = Math.max(todayAllowance, 45000);
  const budgetBreakfast = Math.round(effectiveBudget * 0.22);
  const budgetLunch = Math.round(effectiveBudget * 0.42);
  const budgetDinner = Math.round(effectiveBudget * 0.36);

  const filterByBudget = (type: MealSlot, target: number) => {
    const list = ALL_MEALS.filter((m) => m.type === type);
    const within = list.filter((m) => m.price <= target * 1.35);
    return within.length > 0 ? within : list;
  };

  const breakfastOptions = useMemo(() => filterByBudget('breakfast', budgetBreakfast), [budgetBreakfast]);
  const lunchOptions = useMemo(() => filterByBudget('lunch', budgetLunch), [budgetLunch]);
  const dinnerOptions = useMemo(() => filterByBudget('dinner', budgetDinner), [budgetDinner]);

  const loggedTodayNames = useMemo(
    () => new Set(todayTransactions.map((t) => t.merchant.trim().toLowerCase())),
    [todayTransactions]
  );

  const getSlotDisplay = (slot: MealSlot, options: MealItem[], offset: number) => {
    const remembered = eatenSlots[slot];
    if (remembered && loggedTodayNames.has(remembered.name.toLowerCase())) {
      return { meal: remembered, isEaten: true };
    }
    const matchedFromHistory = ALL_MEALS.find(
      (m) => m.type === slot && loggedTodayNames.has(m.name.toLowerCase())
    );
    if (matchedFromHistory) {
      return { meal: matchedFromHistory, isEaten: true };
    }
    const candidate = options[(randomSeed + offset) % options.length];
    return { meal: candidate, isEaten: false };
  };

  const breakfast = getSlotDisplay('breakfast', breakfastOptions, 0);
  const lunch = getSlotDisplay('lunch', lunchOptions, 1);
  const dinner = getSlotDisplay('dinner', dinnerOptions, 2);

  const slots = [
    {
      slot: 'breakfast' as MealSlot,
      title: 'Bữa sáng',
      icon: Sun,
      accent: 'text-[var(--tone-caution)]',
      target: budgetBreakfast,
      ...breakfast,
    },
    {
      slot: 'lunch' as MealSlot,
      title: 'Bữa trưa',
      icon: Utensils,
      accent: 'text-[var(--brand)]',
      target: budgetLunch,
      ...lunch,
    },
    {
      slot: 'dinner' as MealSlot,
      title: 'Bữa tối',
      icon: Moon,
      accent: 'text-[var(--ink-primary)]',
      target: budgetDinner,
      ...dinner,
    },
  ];

  const totalMealCost =
    (breakfast.meal?.price || 0) + (lunch.meal?.price || 0) + (dinner.meal?.price || 0);

  const handleChooseMeal = (slot: MealSlot, meal: MealItem, isEaten: boolean) => {
    if (isEaten || !meal) return;
    setEatenSlots((prev) => ({ ...prev, [slot]: meal }));
    onSelectMeal(meal.name, meal.price, selectedWalletId || bestDefaultWalletId);
  };

  return (
    <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3.5 animate-page-enter">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-light)] border border-[var(--color-bbf7d0)] text-[var(--brand)] flex items-center justify-center shrink-0">
            <ChefHat className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--ink-primary)] truncate">
              Gợi ý ăn uống hôm nay
            </h2>
            <p className="text-xs text-[var(--ink-muted)] tabular-nums truncate">
              Theo hạn mức:{' '}
              <span className="font-semibold text-[var(--brand)]">{formatVND(effectiveBudget)}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRandomSeed((prev) => prev + 1)}
          className="tap-scale shrink-0 flex items-center gap-1 px-3 h-8 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--border-hairline)] text-[var(--ink-primary)] text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Đổi món</span>
        </button>
      </div>

      {/* Wallet Selector for Meal Payment */}
      {spendingWallets.length > 0 && (
        <div className="flex items-center gap-2.5">
          <label htmlFor="meal-wallet-select" className="text-xs font-semibold text-[var(--ink-muted)] shrink-0">Trừ từ ví:</label>
          <select
            id="meal-wallet-select"
            value={selectedWalletId}
            onChange={(e) => setSelectedWalletId(e.target.value)}
            className="app-input flex-1 min-w-0"
          >
            {spendingWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {formatVND(w.balance)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3 Meal Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {slots.map(({ slot, title, icon: Icon, accent, meal, isEaten }) => (
          <div
            key={slot}
            className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition-[color,background-color,border-color,opacity,transform] duration-200 ${
              isEaten
                ? 'bg-[var(--brand-light)] border-[var(--color-bbf7d0)]'
                : 'bg-[var(--bg-paper)] border-[var(--border-hairline)]'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${accent}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{title}</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--tone-white)] border border-[var(--border-hairline)] text-[var(--ink-muted)] whitespace-nowrap">
                  {meal?.tag}
                </span>
              </div>

              <p className="text-xs font-semibold text-[var(--ink-primary)] leading-snug line-clamp-2">
                {meal?.name}
              </p>
              <p className="text-xs font-semibold text-[var(--brand)] tabular-nums">
                {formatVND(meal?.price || 0)}
              </p>
            </div>

            {isEaten ? (
              <div className="animate-pop h-9 rounded-lg bg-[var(--tone-white)] border border-[var(--color-bbf7d0)] text-[var(--brand)] text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap">
                <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
                <span>Đã ăn hôm nay</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => meal && handleChooseMeal(slot, meal, isEaten)}
                className="tap-scale w-full h-9 px-2.5 rounded-lg bg-[var(--tone-white)] hover:bg-[var(--brand-light)] border border-[var(--border-hairline)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--brand)] cursor-pointer whitespace-nowrap"
              >
                + Ghi ăn món này
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="pt-2.5 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[var(--ink-muted)] tabular-nums">
          Tổng 3 bữa:{' '}
          <span className="font-semibold text-[var(--ink-primary)]">{formatVND(totalMealCost)}</span>
        </span>
        {totalMealCost <= effectiveBudget ? (
          <span className="text-xs font-semibold text-[var(--brand)] bg-[var(--brand-light)] px-2.5 py-0.5 rounded-full border border-[var(--color-bbf7d0)] whitespace-nowrap">
            Trong ngân sách ngày
          </span>
        ) : (
          <span className="text-xs font-semibold text-[var(--tone-danger)] bg-[var(--tone-danger-soft)] px-2.5 py-0.5 rounded-full border border-[var(--tone-danger-border)] whitespace-nowrap">
            Vượt {formatVND(totalMealCost - effectiveBudget)}
          </span>
        )}
      </div>
    </section>
  );
};
