import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSync } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import { CgSpinner } from 'react-icons/cg';
import { UsageDataRow } from '@common/types';
import clsx from 'clsx';

import { DatePicker } from '@/components/common/DatePicker';
import { MultiSelect } from '@/components/common/MultiSelect';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  onClose: () => void;
};

enum DatePeriod {
  ThisMonth = 'thisMonth',
  Today = 'today',
  Custom = 'custom',
}

export const UsageDashboard = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const [data, setData] = useState<UsageDataRow[]>([]);
  const [filteredData, setFilteredData] = useState<UsageDataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>(DatePeriod.ThisMonth);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return [startOfMonth, now];
  });
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [modelFilter, setModelFilter] = useState<string[]>([]);

  const projectOptions = useMemo(() => {
    const projects = [...new Set(data.map((row) => row.project))];
    return projects.map((p) => ({ value: p, label: p.split('/').pop() || p }));
  }, [data]);

  const modelOptions = useMemo(() => {
    const models = [...new Set(data.map((row) => row.model))];
    return models.map((m) => ({ value: m, label: m }));
  }, [data]);

  const handlePeriodChange = (period: DatePeriod) => {
    setSelectedPeriod(period);

    const now = new Date();
    let startDate: Date;
    const endDate: Date = now;

    if (period === DatePeriod.Today) {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      // This month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    setDateRange([startDate, endDate]);
  };

  const handleDateRangeChange = (update: [Date | null, Date | null]) => {
    setDateRange(update);

    setSelectedPeriod(DatePeriod.Custom);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [from, to] = dateRange;
      if (from && to) {
        const result = await window.api.queryUsageData(from.toISOString(), to.toISOString());
        setData(result);
      }
    } catch {
      setError(t('usageDashboard.error.fetch'));
    } finally {
      setLoading(false);
    }
  }, [dateRange, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    let result = data;
    // Treat empty selections as "all selected"
    if (projectFilter.length > 0) {
      result = result.filter((row) => projectFilter.includes(row.project));
    }
    if (modelFilter.length > 0) {
      result = result.filter((row) => modelFilter.includes(row.model));
    }
    setFilteredData(result);
  }, [data, projectFilter, modelFilter]);

  // Aggregate data by day
  const aggregatedData = useMemo(() => {
    const aggregatedMap = new Map<string, UsageDataRow>();

    filteredData.forEach((row) => {
      const date = new Date(row.timestamp).toISOString().split('T')[0]; // Get YYYY-MM-DD format
      const key = date;

      if (aggregatedMap.has(key)) {
        const existing = aggregatedMap.get(key)!;
        const newProjects = new Set(existing.project.split('\n'));
        newProjects.add(row.project.split(/[\\/]/).pop() || row.project);
        const newModels = new Set(existing.model.split('\n'));
        newModels.add(row.model);

        aggregatedMap.set(key, {
          ...existing,
          project: [...newProjects].join('\n'),
          model: [...newModels].join('\n'),
          input_tokens: (existing.input_tokens || 0) + (row.input_tokens || 0),
          output_tokens: (existing.output_tokens || 0) + (row.output_tokens || 0),
          cache_read_tokens: (existing.cache_read_tokens || 0) + (row.cache_read_tokens || 0),
          cache_write_tokens: (existing.cache_write_tokens || 0) + (row.cache_write_tokens || 0),
          cost: (existing.cost || 0) + (row.cost || 0),
        });
      } else {
        aggregatedMap.set(key, {
          ...row,
          project: row.project.split(/[\\/]/).pop() || row.project,
          timestamp: date, // Use date string for display
        });
      }
    });

    return Array.from(aggregatedMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [filteredData]);

  const totals = useMemo(() => {
    return aggregatedData.reduce(
      (acc, row) => ({
        input: acc.input + (row.input_tokens || 0),
        output: acc.output + (row.output_tokens || 0),
        cacheRead: acc.cacheRead + (row.cache_read_tokens || 0),
        cacheWrite: acc.cacheWrite + (row.cache_write_tokens || 0),
        totalTokens: acc.totalTokens + (row.input_tokens || 0) + (row.output_tokens || 0),
        cost: acc.cost + (row.cost || 0),
      }),
      {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: 0,
      },
    );
  }, [aggregatedData]);

  const handleRefresh = () => {
    void fetchData();
  };

  return (
    <div className="absolute inset-0 bg-neutral-900 z-50 flex flex-col">
      <div className="flex items-center border-b-2 border-neutral-600 justify-between bg-gradient-to-b from-neutral-950 to-neutral-900 min-h-[40px] pl-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-md uppercase font-medium text-neutral-100">{t('usageDashboard.title')}</h2>
        </div>
        <IconButton
          icon={<IoMdClose className="h-5 w-5 text-neutral-200" />}
          onClick={onClose}
          tooltip={t('common.close')}
          className="px-4 py-2 hover:text-neutral-200 hover:bg-neutral-700/30 transition-colors duration-200"
        />
      </div>

      <div className="flex items-center space-x-4 p-4 border-b-2 border-neutral-800">
        <div className="flex items-end space-x-2">
          <DatePicker
            label={t('usageDashboard.dateRange')}
            className="min-w-[250px]"
            selectsRange
            startDate={dateRange[0]}
            endDate={dateRange[1]}
            onChange={handleDateRangeChange}
          />
          <div className="flex bg-neutral-800 rounded-md p-1">
            <button
              onClick={() => handlePeriodChange(DatePeriod.ThisMonth)}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors duration-200',
                selectedPeriod === DatePeriod.ThisMonth ? 'bg-neutral-600 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700',
              )}
            >
              {t('usageDashboard.thisMonth')}
            </button>
            <button
              onClick={() => handlePeriodChange(DatePeriod.Today)}
              className={clsx(
                'px-3 py-1 text-sm rounded transition-colors duration-200',
                selectedPeriod === DatePeriod.Today ? 'bg-neutral-600 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700',
              )}
            >
              {t('usageDashboard.today')}
            </button>
          </div>
        </div>
        <div className="flex items-end space-x-2">
          <MultiSelect
            options={projectOptions}
            selected={projectFilter}
            onChange={setProjectFilter}
            label={t('usageDashboard.projects')}
            className="min-w-[220px]"
            noneSelectedLabel={t('multiselect.allSelected')}
          />
          <MultiSelect
            options={modelOptions}
            selected={modelFilter}
            onChange={setModelFilter}
            label={t('usageDashboard.models')}
            className="min-w-[220px]"
            noneSelectedLabel={t('multiselect.allSelected')}
          />
          <IconButton
            icon={<FaSync className={loading ? 'animate-spin' : ''} />}
            onClick={handleRefresh}
            disabled={loading}
            tooltip={loading ? t('common.loading') : t('usageDashboard.refresh')}
            className="p-2 hover:bg-neutral-800 rounded-md mb-1"
          />
        </div>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {loading ? (
        <div className="flex-grow flex items-center justify-center">
          <CgSpinner className="animate-spin w-10 h-10 text-neutral-100" />
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-700">
          <div className="min-h-full">
            <table className="w-full text-sm text-left text-neutral-400">
              <thead className="text-xs text-neutral-100 uppercase bg-neutral-800 sticky top-0">
                <tr>
                  <th className="px-4 py-2">{t('usageDashboard.table.date')}</th>
                  <th className="px-4 py-2">{t('usageDashboard.table.project')}</th>
                  <th className="px-4 py-2">{t('usageDashboard.table.model')}</th>
                  <th className="px-4 py-2 text-right">{t('usageDashboard.table.input')}</th>
                  <th className="px-4 py-2 text-right">{t('usageDashboard.table.output')}</th>
                  <th className="px-4 py-2 text-right">{t('usageDashboard.table.cacheRead')}</th>
                  <th className="px-4 py-2 text-right">{t('usageDashboard.table.cacheWrite')}</th>
                  <th className="px-4 py-2 text-right">{t('usageDashboard.table.totalTokens')}</th>
                  <th className="px-4 py-2 text-right">{t('usageDashboard.table.cost')}</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedData.map((row, index) => (
                  <tr key={index} className="bg-neutral-900 border-b border-neutral-800 hover:bg-neutral-800/50 text-sm">
                    <td className="px-4 py-2">{new Date(row.timestamp).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <div className="whitespace-pre-line text-xs">{row.project}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="whitespace-pre-line text-xs">{row.model}</div>
                    </td>
                    <td className="px-4 py-2 text-right">{row.input_tokens || 0}</td>
                    <td className="px-4 py-2 text-right">{row.output_tokens || 0}</td>
                    <td className="px-4 py-2 text-right">{row.cache_read_tokens || 0}</td>
                    <td className="px-4 py-2 text-right">{row.cache_write_tokens || 0}</td>
                    <td className="px-4 py-2 text-right">{(row.input_tokens || 0) + (row.output_tokens || 0)}</td>
                    <td className="px-4 py-2 text-right">${(row.cost || 0).toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-neutral-800 text-xs uppercase text-neutral-100">
                <tr>
                  <th colSpan={3} className="px-4 py-2 text-left font-medium">
                    {t('usageDashboard.total')}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">{totals.input}</th>
                  <th className="px-4 py-2 text-right font-medium">{totals.output}</th>
                  <th className="px-4 py-2 text-right font-medium">{totals.cacheRead}</th>
                  <th className="px-4 py-2 text-right font-medium">{totals.cacheWrite}</th>
                  <th className="px-4 py-2 text-right font-medium">{totals.totalTokens}</th>
                  <th className="px-4 py-2 text-right font-medium">${totals.cost.toFixed(6)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
