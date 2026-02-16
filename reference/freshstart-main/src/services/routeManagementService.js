import { supabase } from '../lib/supabase';

// Helper to get authenticated session with retry logic
async function getAuthenticatedSession(retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      throw new Error('Failed to verify authentication. Please try logging in again.');
    }
    
    if (session?.user) {
      return session;
    }
    
    // Wait before retry (except on last attempt)
    if (i < retries - 1) {
      console.log(`Session not found, retrying (${i + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All retries failed
  throw new Error('Authentication session expired. Please log out and log back in.');
}

export async function createRoute(routeData) {
  try {
    const session = await getAuthenticatedSession();
    const user = session.user;
    
    console.log('Creating route for user:', user.id);
    
    const { data, error } = await supabase
      .from('routes')
      .insert({
        user_id: user.id,
        route_number: routeData.routeNumber,
        start_time: routeData.startTime || '07:30',
        tour_length: parseFloat(routeData.tourLength) || 8.5,
        lunch_duration: parseInt(routeData.lunchDuration) || 30,
        comfort_stop_duration: parseInt(routeData.comfortStopDuration) || 10,
        is_active: true,
      })
      .select()
      .maybeSingle();
    
    if (error) {
      console.error('Error creating route:', error);
      
      // Provide helpful error messages
      if (error.code === '42501') {
        throw new Error('Permission denied. Please check your account permissions.');
      } else if (error.code === '23505') {
        throw new Error('A route with this number already exists for your account.');
      } else {
        throw new Error(`Failed to create route: ${error.message}`);
      }
    }
    
    console.log('Route created successfully:', data);
    return data;
  } catch (error) {
    console.error('createRoute error:', error);
    throw error;
  }
}

export async function updateRoute(routeId, updates) {
  try {
    const session = await getAuthenticatedSession();
    const user = session.user;
    
    const { data, error } = await supabase
      .from('routes')
      .update({
        route_number: updates.routeNumber,
        start_time: updates.startTime,
        tour_length: parseFloat(updates.tourLength),
        lunch_duration: parseInt(updates.lunchDuration),
        comfort_stop_duration: parseInt(updates.comfortStopDuration),
        updated_at: new Date().toISOString(),
      })
      .eq('id', routeId)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();
    
    if (error) {
      console.error('Error updating route:', error);
      throw new Error(`Failed to update route: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('updateRoute error:', error);
    throw error;
  }
}

export async function deleteRoute(routeId) {
  try {
    const session = await getAuthenticatedSession();
    const user = session.user;
    
    const { error } = await supabase
      .from('routes')
      .delete()
      .eq('id', routeId)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error deleting route:', error);
      throw new Error(`Failed to delete route: ${error.message}`);
    }
    
    return true;
  } catch (error) {
    console.error('deleteRoute error:', error);
    throw error;
  }
}

export async function setActiveRoute(routeId) {
  try {
    const session = await getAuthenticatedSession();
    const user = session.user;
    
    // First, deactivate all routes for this user
    await supabase
      .from('routes')
      .update({ is_active: false })
      .eq('user_id', user.id);
    
    // Then activate the selected route
    const { data, error } = await supabase
      .from('routes')
      .update({ is_active: true })
      .eq('id', routeId)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();
    
    if (error) {
      console.error('Error setting active route:', error);
      throw new Error(`Failed to set active route: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('setActiveRoute error:', error);
    throw error;
  }
}
