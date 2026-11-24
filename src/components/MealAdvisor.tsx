import React, { useEffect, useMemo, useState } from 'react';
import { Check, Moon, RefreshCw, Sun, Utensils } from 'lucide-react';
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
  // Bữa sáng (0đ -> 40k)
  { id: 'b0', name: '2 ly nước lọc + hít không khí sạch', price: 0, type: 'breakfast', tag: 'Quang hợp' },
  { id: 'b0a', name: 'Trà đá vỉa hè + ngắm người ta ăn phở', price: 3000, type: 'breakfast', tag: 'Tâm linh' },
  { id: 'b0b', name: 'Cà phê tự pha + 2 cái bánh quy', price: 5000, type: 'breakfast', tag: 'Tỉnh táo' },
  { id: 'b0c', name: 'Bánh mì không chấm sữa Ông Thọ', price: 8000, type: 'breakfast', tag: 'Tuổi thơ' },
  { id: 'b0d', name: 'Xôi xéo hành phi gói lá chuối', price: 10000, type: 'breakfast', tag: 'Chắc dạ' },
  { id: 'b0e', name: 'Bánh mì ngọt + nước lọc công ty', price: 12000, type: 'breakfast', tag: 'Tối giản' },
  { id: 'b7', name: 'Mì gói úp 1 quả trứng gà', price: 15000, type: 'breakfast', tag: 'Quốc dân' },
  { id: 'b7b', name: 'Bánh giò nóng + tương ớt', price: 15000, type: 'breakfast', tag: 'Ấm bụng' },
  { id: 'b6', name: 'Xôi mặn chả lụa ruốc bông', price: 18000, type: 'breakfast', tag: 'No lâu' },
  { id: 'b1', name: 'Bánh mì ốp la pate dưa leo', price: 20000, type: 'breakfast', tag: 'Nhanh gọn' },
  { id: 'b5', name: 'Bánh cuốn nóng chả quế', price: 25000, type: 'breakfast', tag: 'Thanh đạm' },
  { id: 'b4', name: 'Bún riêu cua đồng', price: 30000, type: 'breakfast', tag: 'Đậm đà' },
  { id: 'b3', name: 'Phở bò tái chín', price: 40000, type: 'breakfast', tag: 'Chất lượng' },

  // Bữa trưa (0đ -> 65k)
  { id: 'l0', name: 'Nhịn trưa uống nước lọc giữ dáng', price: 0, type: 'lunch', tag: 'Siết cân' },
  { id: 'l0b', name: 'Bánh mì ngọt + ngủ trưa 1 giấc', price: 10000, type: 'lunch', tag: 'Tiết kiệm' },
  { id: 'l0c', name: 'Cơm trắng + trứng chiên nước mắm', price: 12000, type: 'lunch', tag: 'Cơm nhà' },
  { id: 'l0d', name: 'Bánh mì chả cá nóng giòn', price: 15000, type: 'lunch', tag: 'Chống đói' },
  { id: 'l0e', name: 'Xôi gà xé mini', price: 18000, type: 'lunch', tag: 'Gọn lẹ' },
  { id: 'l0f', name: 'Bánh mì thịt nướng đầy đủ', price: 20000, type: 'lunch', tag: 'Vừa ví' },
  { id: 'l7', name: 'Cơm bình dân 1 mặn 1 canh', price: 25000, type: 'lunch', tag: 'Đủ chất' },
  { id: 'l2', name: 'Cơm văn phòng 2 món tự chọn', price: 35000, type: 'lunch', tag: 'Cân bằng' },
  { id: 'l1', name: 'Cơm tấm sườn bì chả', price: 40000, type: 'lunch', tag: 'Quen thuộc' },
  { id: 'l3', name: 'Bún chả Hà Nội', price: 45000, type: 'lunch', tag: 'Hấp dẫn' },
  { id: 'l8', name: 'Cơm Bento cá thu Nhật', price: 65000, type: 'lunch', tag: 'Cao cấp' },

  // Bữa tối (0đ -> 79k)
  { id: 'd0', name: 'Đánh răng sớm rồi đi ngủ luôn', price: 0, type: 'dinner', tag: 'Kỷ luật' },
  { id: 'd0b', name: 'Mì Hảo Hảo chua cay không topping', price: 5000, type: 'dinner', tag: 'Huyền thoại' },
  { id: 'd0c', name: 'Cháo trắng hột vịt muối', price: 10000, type: 'dinner', tag: 'Nhẹ bụng' },
  { id: 'd0d', name: 'Cơm nguội chiên trứng hành lá', price: 12000, type: 'dinner', tag: 'Tự nấu' },
  { id: 'd0e', name: 'Mì gói 2 trứng + ít rau cải', price: 15000, type: 'dinner', tag: 'Tăng đạm' },
  { id: 'd0f', name: 'Bánh canh cua lề đường', price: 20000, type: 'dinner', tag: 'Ấm bụng' },
  { id: 'd5', name: 'Hủ tiếu gõ đầu hẻm', price: 25000, type: 'dinner', tag: 'Chân ái' },
  { id: 'd5b', name: 'Cháo sườn quẩy nóng', price: 30000, type: 'dinner', tag: 'Nhẹ bụng' },
  { id: 'd1', name: 'Tự nấu: Thịt kho + canh rau', price: 35000, type: 'dinner', tag: 'Cơm nhà' },
  { id: 'd2', name: 'Hủ tiếu Nam Vang', price: 40000, type: 'dinner', tag: 'Thưởng thức' },
  { id: 'd7', name: 'Bò né bánh mì tiêu đen', price: 55000, type: 'dinner', tag: 'Ngon miệng' },
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

  const effectiveBudget = Math.max(0, todayAllowance);

  // Build valid 3-meal combos whose TOTAL cost <= effectiveBudget
  const validCombos = useMemo(() => {
    const breakfasts = ALL_MEALS.filter((m) => m.type === 'breakfast' && m.price <= effectiveBudget);
    const lunches = ALL_MEALS.filter((m) => m.type === 'lunch' && m.price <= effectiveBudget);
    const dinners = ALL_MEALS.filter((m) => m.type === 'dinner' && m.price <= effectiveBudget);

    const combos: { b: MealItem; l: MealItem; d: MealItem; total: number }[] = [];
    for (const b of breakfasts) {
      for (const l of lunches) {
        if (b.price + l.price > effectiveBudget) continue;
        for (const d of dinners) {
          const total = b.price + l.price + d.price;
          if (total <= effectiveBudget) {
            combos.push({ b, l, d, total });
          }
        }
      }
    }

    if (combos.length === 0) {
      return [{ b: ALL_MEALS[0], l: ALL_MEALS[13], d: ALL_MEALS[24], total: 0 }];
    }

    const sweetSpot = combos.filter((c) => c.total >= effectiveBudget * 0.55);
    const pool = sweetSpot.length > 0 ? sweetSpot : combos;
    return pool.sort((a, b) => b.total - a.total);
  }, [effectiveBudget]);

  const chosenCombo = validCombos[randomSeed % validCombos.length];

  const loggedTodayNames = useMemo(
    () => new Set(todayTransactions.map((t) => t.merchant.trim().toLowerCase())),
    [todayTransactions]
  );

  const getSlotDisplay = (slot: MealSlot, candidate: MealItem) => {
    const remembered = eatenSlots[slot];
    if (remembered && (remembered.price === 0 || loggedTodayNames.has(remembered.name.toLowerCase()))) {
      return { meal: remembered, isEaten: true };
    }
    const matchedFromHistory = ALL_MEALS.find(
      (m) => m.type === slot && loggedTodayNames.has(m.name.toLowerCase())
    );
    if (matchedFromHistory) {
      return { meal: matchedFromHistory, isEaten: true };
    }
    return { meal: candidate, isEaten: false };
  };

  const breakfast = getSlotDisplay('breakfast', chosenCombo.b);
  const lunch = getSlotDisplay('lunch', chosenCombo.l);
  const dinner = getSlotDisplay('dinner', chosenCombo.d);

  const slots = [
    {
      slot: 'breakfast' as MealSlot,
      title: 'Bữa sáng',
      icon: Sun,
      accent: 'text-[var(--tone-caution)]',
      ...breakfast,
    },
    {
      slot: 'lunch' as MealSlot,
      title: 'Bữa trưa',
      icon: Utensils,
      accent: 'text-[var(--brand)]',
      ...lunch,
    },
    {
      slot: 'dinner' as MealSlot,
      title: 'Bữa tối',
      icon: Moon,
      accent: 'text-[var(--ink-primary)]',
      ...dinner,
    },
  ];

  const totalMealCost =
    (breakfast.meal?.price || 0) + (lunch.meal?.price || 0) + (dinner.meal?.price || 0);

  const funBanner =
    effectiveBudget <= 0
      ? 'Hôm nay 0 đ: Uống nước lọc, hít khí trời, mai làm lại từ đầu!'
      : effectiveBudget <= 25000
      ? `Chế độ sinh tồn ${formatVND(effectiveBudget)}: Bóp nát chi tiêu, giữ vững ví tiền!`
      : effectiveBudget <= 50000
      ? `Thực đơn thắt lưng buộc bụng trong ${formatVND(effectiveBudget)} — vẫn no, vẫn vui.`
      : `Hạn mức ${formatVND(effectiveBudget)} — ăn ngon mà vẫn dư tiền cuối ngày.`;

  const handleChooseMeal = (slot: MealSlot, meal: MealItem, isEaten: boolean) => {
    if (isEaten || !meal) return;
    setEatenSlots((prev) => ({ ...prev, [slot]: meal }));
    if (meal.price > 0) {
      onSelectMeal(meal.name, meal.price, selectedWalletId || bestDefaultWalletId);
    }
  };

  return (
    <section className="bg-[var(--tone-white)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3.5 animate-page-enter">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--ink-primary)] whitespace-nowrap">
            Thực đơn hôm nay
          </h2>
          <p className="text-xs text-[var(--ink-muted)] tabular-nums whitespace-nowrap">
            Hạn mức:{' '}
            <span className="font-semibold text-[var(--brand)]">{formatVND(effectiveBudget)}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRandomSeed((prev) => prev + 1)}
          className="tap-scale shrink-0 flex items-center gap-1 px-3 h-8 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--border-hairline)] text-[var(--ink-primary)] text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Đổi combo</span>
        </button>
      </div>

      {/* Smooth Horizontal Marquee Slider */}
      <div className="bg-[var(--bg-paper)] border border-[var(--border-hairline)] rounded-xl px-3 py-2 overflow-hidden">
        <div className="animate-marquee text-xs text-[var(--ink-primary)] whitespace-nowrap">
          <span className="pr-12">{funBanner}</span>
          <span className="pr-12" aria-hidden="true">{funBanner}</span>
        </div>
      </div>

      {/* Wallet Selector for Meal Payment (only shown if multiple spending wallets exist) */}
      {spendingWallets.length > 1 && (
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
                {meal?.price === 0 ? '0 đ (Miễn phí)' : formatVND(meal?.price || 0)}
              </p>
            </div>

            {isEaten ? (
              <div className="animate-pop h-9 rounded-lg bg-[var(--tone-white)] border border-[var(--color-bbf7d0)] text-[var(--brand)] text-xs font-semibold flex items-center justify-center gap-1 whitespace-nowrap">
                <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
                <span>Đã chốt hôm nay</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => meal && handleChooseMeal(slot, meal, isEaten)}
                className="tap-scale w-full h-9 px-2.5 rounded-lg bg-[var(--tone-white)] hover:bg-[var(--brand-light)] border border-[var(--border-hairline)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--brand)] cursor-pointer whitespace-nowrap"
              >
                {meal?.price === 0 ? '+ Chốt kèo nhịn (0 đ)' : '+ Ghi ăn món này'}
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
            Còn dư {formatVND(effectiveBudget - totalMealCost)}
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
