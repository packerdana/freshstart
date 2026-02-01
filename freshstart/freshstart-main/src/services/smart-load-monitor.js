import { supabase } from '../lib/supabase';

export class SmartLoadMonitor {
  constructor() {
    this.loadingHistory = [];
  }

  async loadHistoryFromDatabase(userId) {
    try {
      const { data, error } = await supabase
        .from('loading_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      this.loadingHistory = data || [];
      console.log('Loaded loading history:', this.loadingHistory.length, 'entries');

      return this.loadingHistory;
    } catch (error) {
      console.error('Error loading history from database:', error);
      return [];
    }
  }

  async saveLoadingEntry(userId, packageCount, loadingTime) {
    try {
      const { data, error } = await supabase
        .from('loading_history')
        .insert({
          user_id: userId,
          package_count: packageCount,
          loading_time: loadingTime,
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      if (data) {
        this.loadingHistory.unshift(data);
      }

      console.log('Saved loading entry to database:', data);

      return data;
    } catch (error) {
      console.error('Error saving loading entry:', error);
      return null;
    }
  }

  async getAverageLoadTime(packageCount) {
    const rangePercent = 0.2;
    const minPackageCount = Math.floor(packageCount * (1 - rangePercent));
    const maxPackageCount = Math.ceil(packageCount * (1 + rangePercent));

    console.log(`Calculating average load time for ${packageCount} packages (range: ${minPackageCount}-${maxPackageCount})`);

    const matchingEntries = this.loadingHistory.filter(entry => {
      return entry.package_count >= minPackageCount && entry.package_count <= maxPackageCount;
    });

    if (matchingEntries.length === 0) {
      console.log('No matching history entries found');
      return null;
    }

    const totalLoadingTime = matchingEntries.reduce((sum, entry) => {
      return sum + entry.loading_time;
    }, 0);

    const averageLoadTime = totalLoadingTime / matchingEntries.length;

    console.log(`Found ${matchingEntries.length} matching entries, average: ${Math.round(averageLoadTime)}ms`);

    return averageLoadTime;
  }

  getExpectedLoadTime(packageCount, averageLoadTime = null) {
    if (averageLoadTime !== null) {
      return Math.round(averageLoadTime / 1000);
    }

    const baseTime = 300;
    const timePerPackage = 6;
    return baseTime + (packageCount * timePerPackage);
  }
}

export const smartLoadMonitor = new SmartLoadMonitor();
