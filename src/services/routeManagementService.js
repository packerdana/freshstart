import { supabase } from '../lib/supabase';

export async function createRoute(routeData) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated to create a route');
  }

  const { data, error } = await supabase
    .from('routes')
    .insert({
      user_id: user.id,
      route_number: routeData.routeNumber,
      start_time: routeData.startTime || '07:30',
      tour_length: routeData.tourLength || 8.5,
      lunch_duration: routeData.lunchDuration || 30,
      comfort_stop_duration: routeData.comfortStopDuration || 10,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating route:', error);
    throw error;
  }

  return data;
}

export async function updateRoute(routeId, updates) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { data, error } = await supabase
    .from('routes')
    .update({
      route_number: updates.routeNumber,
      start_time: updates.startTime,
      tour_length: updates.tourLength,
      lunch_duration: updates.lunchDuration,
      comfort_stop_duration: updates.comfortStopDuration,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routeId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating route:', error);
    throw error;
  }

  return data;
}

export async function deleteRoute(routeId) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', routeId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting route:', error);
    throw error;
  }

  return true;
}

export async function setActiveRoute(routeId) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated');
  }

  await supabase
    .from('routes')
    .update({ is_active: false })
    .eq('user_id', user.id);

  const { data, error } = await supabase
    .from('routes')
    .update({ is_active: true })
    .eq('id', routeId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error setting active route:', error);
    throw error;
  }

  return data;
}
