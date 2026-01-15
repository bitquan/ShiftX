# ShiftX Phase 1 - Smoke Test Checklist

## Pre-flight
- [ ] Start Firebase emulators: `firebase emulators:start --only auth,functions,firestore`
- [ ] Start driver app dev server (port 4173)
- [ ] Start customer app dev server (port 5173)

## Driver Setup
1. **Open driver app** (http://localhost:4173)
2. **Sign in anonymously** (auto-triggers)
3. **Go to Profile tab** (bottom nav)
4. **Configure Vehicle & Rates:**
   - [ ] Select vehicle class (ShiftX / Shift LX / Shift Black)
   - [ ] Verify only allowed rate cards show (ShiftX driver sees 1, LX sees 2, Black sees 3)
   - [ ] Set rates (or keep defaults)
   - [ ] Click "Save Vehicle & Rates"
   - [ ] Verify success toast
5. **Go Online:**
   - [ ] Go to Home tab
   - [ ] Toggle "Go Online"
   - [ ] Verify status shows "Online" with location updating

## Customer Experience
1. **Open customer app** (http://localhost:5173)
2. **Sign in anonymously** (auto-triggers)
3. **Check initial map center:**
   - [ ] Map should center near your actual location (or cached location)
   - [ ] NOT defaulting to DC unless location fails
4. **Verify nearby driver pins:**
   - [ ] See driver pin(s) on map (semi-transparent car icons)
   - [ ] Pins should be near pickup location
5. **Test "Use My Location" button:**
   - [ ] Click button
   - [ ] Verify loading state ("⏳ Getting location...")
   - [ ] Verify pickup sets to your location
   - [ ] Verify address input updates with resolved address
   - [ ] Verify map centers on your location
6. **Test pickup/dropoff sync (TAP method):**
   - [ ] Click map to set pickup
   - [ ] Verify green pickup pin appears
   - [ ] Verify "From" input updates with reverse-geocoded address
   - [ ] Click map again to set dropoff
   - [ ] Verify blue dropoff pin appears
   - [ ] Verify "To" input updates with address
   - [ ] Verify route line appears (blue glowing line)
7. **Test pickup/dropoff sync (TYPE method):**
   - [ ] Clear existing locations
   - [ ] Type in "From" input
   - [ ] Verify autocomplete dropdown appears
   - [ ] Select a suggestion
   - [ ] Verify green pin appears on map at that location
   - [ ] Repeat for "To" input
8. **Test service card availability:**
   - [ ] Verify only available service classes are enabled
   - [ ] If driver is ShiftX: only ShiftX card enabled, others greyed
   - [ ] If driver is Shift LX: ShiftX + Shift LX enabled
   - [ ] If driver is Shift Black: all three enabled
   - [ ] Verify disabled cards show "No drivers available"
9. **Test pricing:**
   - [ ] With pickup/dropoff set, verify fare estimates show
   - [ ] Verify estimates match driver's configured rates
   - [ ] Verify minimum fare displayed
   - [ ] Select different service classes, verify prices change
10. **Test Request Ride button:**
    - [ ] Button disabled when no pickup/dropoff
    - [ ] Button disabled when selected service unavailable
    - [ ] Button enabled when all conditions met
    - [ ] Can successfully request ride

## Edge Cases
1. **No drivers online:**
   - [ ] Turn driver offline
   - [ ] Verify all customer service cards grey out
   - [ ] Verify message "No drivers available in your area"
   - [ ] Verify Request button stays disabled
2. **Location permission denied:**
   - [ ] Block location in browser settings
   - [ ] Click "Use My Location"
   - [ ] Verify error message about enabling location
   - [ ] Verify fallback to cached/default location
3. **Stale driver location:**
   - [ ] Stop driver heartbeat (simulate crash)
   - [ ] Wait 60+ seconds
   - [ ] Verify driver pin disappears from customer map
   - [ ] Verify service availability updates

## Success Criteria
✅ All checklist items pass  
✅ No console errors  
✅ Driver can only configure rates for their vehicle class  
✅ Customer only sees available services based on nearby drivers  
✅ Map centers correctly on load  
✅ Pickup/dropoff sync works both ways (tap OR type)  
✅ Pricing reflects actual driver rates  
✅ Request button properly gated by availability
