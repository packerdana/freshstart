import { supabase } from '../lib/supabase';
import { getLocalDateString } from '../utils/time';

export const getTemplatesForRoute = async (routeId) => {
  try {
    const { data, error } = await supabase
      .from('waypoint_templates')
      .select('*')
      .eq('route_id', routeId)
      .order('sequence_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching waypoint templates:', error);
    throw error;
  }
};

export const createTemplate = async (templateData) => {
  try {
    const { data, error } = await supabase
      .from('waypoint_templates')
      .insert([templateData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating waypoint template:', error);
    throw error;
  }
};

export const updateTemplate = async (templateId, updates) => {
  try {
    const { data, error } = await supabase
      .from('waypoint_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating waypoint template:', error);
    throw error;
  }
};

export const deleteTemplate = async (templateId) => {
  try {
    const { error } = await supabase
      .from('waypoint_templates')
      .delete()
      .eq('id', templateId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting waypoint template:', error);
    throw error;
  }
};

export const deleteAllTemplates = async (routeId) => {
  try {
    const { error } = await supabase
      .from('waypoint_templates')
      .delete()
      .eq('route_id', routeId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting all waypoint templates:', error);
    throw error;
  }
};

export const bulkCreateTemplates = async (templates) => {
  try {
    const { data, error } = await supabase
      .from('waypoint_templates')
      .insert(templates)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error bulk creating waypoint templates:', error);
    throw error;
  }
};

export const saveCurrentWaypointsAsTemplate = async (routeId, waypoints) => {
  try {
    await deleteAllTemplates(routeId);

    const templates = waypoints.map(wp => ({
      route_id: routeId,
      name: wp.address,
      sequence_number: wp.sequence_number,
      notes: wp.notes
    }));

    return await bulkCreateTemplates(templates);
  } catch (error) {
    console.error('Error saving waypoints as template:', error);
    throw error;
  }
};

export const instantiateTemplates = async (routeId, date = null) => {
  try {
    const templates = await getTemplatesForRoute(routeId);

    if (templates.length === 0) {
      return [];
    }

    const targetDate = date || getLocalDateString();

    const { data: existing } = await supabase
      .from('waypoints')
      .select('id')
      .eq('route_id', routeId)
      .eq('date', targetDate);

    if (existing && existing.length > 0) {
      console.log('Waypoints already exist for this date, skipping instantiation');
      return [];
    }

    const waypoints = templates.map(template => ({
      route_id: routeId,
      date: targetDate,
      address: template.name,
      sequence_number: template.sequence_number,
      notes: template.notes,
      status: 'pending',
      delivery_time: null
    }));

    const { data, error } = await supabase
      .from('waypoints')
      .insert(waypoints)
      .select();

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error instantiating templates:', error);
    throw error;
  }
};
