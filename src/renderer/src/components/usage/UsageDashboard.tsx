import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSync, FaTable, FaChartBar } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import { CgSpinner } from 'react-icons/cg';
import { UsageDataRow } from '@common/types';
import clsx from 'clsx';

import { Select } from '../common/Select';

import { UsageTable } from './UsageTable';
import { TokenUsageTrendChart } from './TokenUsageTrendChart';
import { CostBreakdownChart } from './CostBreakdownChart';
import { MessageBreakdownChart } from './MessageBreakdownChart';
import { ModelUsageDistributionChart } from './ModelUsageDistributionChart';
import { GroupBy } from './utils';

import { useApi } from '@/context/ApiContext';
import { DatePicker } from '@/components/common/DatePicker';
import { MultiSelect } from '@/components/common/MultiSelect';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  onClose: () => void;
};

enum DatePeriod {
  All = 'all',
  ThisMonth = 'thisMonth',
  Today = 'today',
  Custom = 'custom',
}

enum ViewTab {
  Table = 'table',
  Charts = 'charts',
}

export const UsageDashboard = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const [data, setData] = useState<UsageDataRow[]>([]);
  const [filteredData, setFilteredData] = useState<UsageDataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>(DatePeriod.ThisMonth);
  const [selectedGroupBy, setSelectedGroupBy] = useState<GroupBy>(GroupBy.Day);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return [startOfMonth, now];
  });
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>(ViewTab.Table);

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
    } else if (period === DatePeriod.ThisMonth) {
      // This month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(0);
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
        const result = await api.queryUsageData(from.toISOString(), to.toISOString());
        setData(result);
      }
    } catch {
      setError(t('usageDashboard.error.fetch'));
    } finally {
      setLoading(false);
    }
  }, [dateRange, t, api]);

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

  const handleRefresh = () => {
    void fetchData();
  };

  return (
    <div className="absolute inset-0 bg-bg-primary-light z-50 flex flex-col">
      <div className="flex items-center border-b-2 border-border-default justify-between bg-gradient-to-b from-bg-primary to-bg-primary-light min-h-[40px] pl-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-md uppercase font-medium text-text-primary">{t('usageDashboard.title')}</h2>
        </div>
        <IconButton
          icon={<IoMdClose className="h-5 w-5 text-text-secondary" />}
          onClick={onClose}
          tooltip={t('common.close')}
          className="px-4 py-2 hover:text-text-secondary hover:bg-bg-tertiary-emphasis transition-colors duration-200"
        />
      </div>

      <div className="flex items-center space-x-4 p-4 border-b-2 border-border-dark-light">
        <div className="flex items-end space-x-2">
          <DatePicker
            label={t('usageDashboard.dateRange')}
            className="min-w-[250px]"
            selectsRange
            startDate={dateRange[0]}
            endDate={dateRange[1]}
            onChange={handleDateRangeChange}
          />
          <div className="flex bg-bg-secondary-light rounded-md p-1">
            {[
              { value: DatePeriod.Today, label: t('usageDashboard.today') },
              { value: DatePeriod.ThisMonth, label: t('usageDashboard.thisMonth') },
              { value: DatePeriod.All, label: t('usageDashboard.all') },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => handlePeriodChange(period.value)}
                className={clsx(
                  'px-3 py-1 text-sm rounded transition-colors duration-200',
                  selectedPeriod === period.value ? 'bg-bg-fourth text-text-primary' : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary',
                )}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end space-x-2">
          <Select
            options={[
              { value: GroupBy.Hour, label: t('usageDashboard.periods.hour') },
              { value: GroupBy.Day, label: t('usageDashboard.periods.day') },
              { value: GroupBy.Month, label: t('usageDashboard.periods.month') },
              { value: GroupBy.Year, label: t('usageDashboard.periods.year') },
            ]}
            value={selectedGroupBy}
            onChange={(value) => {
              setSelectedGroupBy(value as GroupBy);
            }}
            label={t('usageDashboard.groupBy')}
            className="min-w-[120px]"
          />
          <MultiSelect
            options={projectOptions}
            selected={projectFilter}
            onChange={setProjectFilter}
            label={t('usageDashboard.projects')}
            className="min-w-[250px]"
            noneSelectedLabel={t('usageDashboard.all')}
          />
          <MultiSelect
            options={modelOptions}
            selected={modelFilter}
            onChange={setModelFilter}
            label={t('usageDashboard.models')}
            className="min-w-[250px]"
            noneSelectedLabel={t('usageDashboard.all')}
          />
          <IconButton
            icon={<FaSync className={loading ? 'animate-spin' : ''} />}
            onClick={handleRefresh}
            disabled={loading}
            tooltip={loading ? t('common.loading') : t('usageDashboard.refresh')}
            className="p-2 hover:bg-bg-secondary-light rounded-md mb-1"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center border-b-2 border-border-dark-light bg-bg-primary-light">
        <div className="flex bg-bg-secondary-light rounded-md p-1 m-4">
          <button
            onClick={() => setActiveTab(ViewTab.Table)}
            className={clsx(
              'px-4 py-2 text-sm rounded transition-colors duration-200 flex items-center space-x-2',
              activeTab === ViewTab.Table ? 'bg-bg-fourth text-text-primary' : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary',
            )}
          >
            <FaTable className="w-4 h-4" />
            <span>{t('usageDashboard.tabs.table')}</span>
          </button>
          <button
            onClick={() => setActiveTab(ViewTab.Charts)}
            className={clsx(
              'px-4 py-2 text-sm rounded transition-colors duration-200 flex items-center space-x-2',
              activeTab === ViewTab.Charts ? 'bg-bg-fourth text-text-primary' : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary',
            )}
          >
            <FaChartBar className="w-4 h-4" />
            <span>{t('usageDashboard.tabs.charts')}</span>
          </button>
        </div>
      </div>

      {error && <div className="text-error mb-4 mx-4">{error}</div>}

      {loading ? (
        <div className="flex-grow flex items-center justify-center">
          <CgSpinner className="animate-spin w-10 h-10 text-text-primary" />
        </div>
      ) : (
        <>
          {activeTab === ViewTab.Table && <UsageTable data={filteredData} groupBy={selectedGroupBy} />}
          {activeTab === ViewTab.Charts && (
            <div className="flex-grow p-2 overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-tertiary">
              <div className="grid grid-cols-1 xl:grid-cols-2">
                <TokenUsageTrendChart data={filteredData} groupBy={selectedGroupBy} />
                <ModelUsageDistributionChart data={filteredData} />
                <CostBreakdownChart data={filteredData} groupBy={selectedGroupBy} />
                <MessageBreakdownChart data={filteredData} groupBy={selectedGroupBy} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
