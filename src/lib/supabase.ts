import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DiaryEntry } from '../types';

// 延迟初始化Supabase客户端
let supabaseInstance: SupabaseClient | null = null;

const getSupabaseClient = () => {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    
    console.log('Supabase URL:', supabaseUrl ? '已配置' : '未配置');
    console.log('Supabase Key:', supabaseAnonKey ? '已配置' : '未配置');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase credentials not found. Please check your .env file.');
      return null;
    }
    
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
      console.log('Supabase client created successfully');
    } catch (err) {
      console.error('Failed to create Supabase client:', err);
      return null;
    }
  }
  return supabaseInstance;
};

// 日记条目相关的数据库操作
export const diaryApi = {
  // 获取所有日记条目
  async getEntries(): Promise<DiaryEntry[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn('Supabase not initialized, returning empty array');
      return [];
    }
    
    console.log('Fetching entries from Supabase...');
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching entries:', error);
      throw error;
    }
    
    console.log('Fetched entries:', data);
    return data || [];
  },

  // 创建新日记条目
  async createEntry(entry: Omit<DiaryEntry, 'id'>): Promise<DiaryEntry> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    
    console.log('Creating entry in Supabase:', entry);
    const { data, error } = await supabase
      .from('entries')
      .insert([entry])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating entry:', error);
      throw error;
    }
    
    console.log('Created entry:', data);
    return data;
  },

  // 更新日记条目
  async updateEntry(id: number, entry: Partial<DiaryEntry>): Promise<DiaryEntry> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    
    console.log('Updating entry in Supabase:', id, entry);
    const { data, error } = await supabase
      .from('entries')
      .update(entry)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating entry:', error);
      throw error;
    }
    
    console.log('Updated entry:', data);
    return data;
  },

  // 删除日记条目
  async deleteEntry(id: number): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }
    
    console.log('Deleting entry from Supabase:', id);
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting entry:', error);
      throw error;
    }
    
    console.log('Deleted entry:', id);
  }
};