import { VehicleClass } from '../hooks/useNearbyDrivers';
import { FareEstimate, formatCurrency } from '../hooks/useFareEstimate';

interface ServiceCardProps {
  vehicleClass: VehicleClass;
  fareEstimate: FareEstimate;
  selected: boolean;
  available: boolean;
  onSelect: (vehicleClass: VehicleClass) => void;
}

const SERVICE_INFO: Record<VehicleClass, { title: string; description: string; icon: string }> =
  {
    shiftx: {
      title: 'ShiftX',
      description: 'Everyday rides',
      icon: '🚗',
    },
    shift_lx: {
      title: 'Shift LX',
      description: 'Extra space & comfort',
      icon: '🚙',
    },
    shift_black: {
      title: 'Shift Black',
      description: 'Premium service',
      icon: '🚕',
    },
  };

export function ServiceCard({
  vehicleClass,
  fareEstimate,
  selected,
  available,
  onSelect,
}: ServiceCardProps) {
  const info = SERVICE_INFO[vehicleClass];

  return (
    <button
      onClick={() => available && onSelect(vehicleClass)}
      disabled={!available}
      style={{
        padding: '14px',
        border: selected ? '2px solid rgba(80,160,255,0.8)' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: '8px',
        backgroundColor: selected
          ? 'rgba(80,160,255,0.1)'
          : !available
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(255,255,255,0.05)',
        cursor: available ? 'pointer' : 'not-allowed',
        transition: 'all 0.2s ease',
        textAlign: 'left',
        width: '100%',
        opacity: available ? 1 : 0.4,
      }}
      onMouseEnter={(e) => {
        if (!selected && available) {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (available) {
          e.currentTarget.style.backgroundColor = selected
            ? 'rgba(80,160,255,0.1)'
            : 'rgba(255,255,255,0.05)';
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
            {info.icon} {info.title}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
            {info.description}
          </div>
          {fareEstimate.minimumCents > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
              Min fare: {formatCurrency(fareEstimate.minimumCents)}
            </div>
          )}
          {!available ? (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,150,100,0.7)', marginTop: '4px' }}>
              No drivers available
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              Drivers set their own rates
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {fareEstimate.estimatedCents > 0 ? (
            <>
              <div
                style={{
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  color: 'rgba(0,255,140,0.95)',
                  marginBottom: '4px',
                }}
              >
                {formatCurrency(fareEstimate.estimatedCents)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>estimate</div>
            </>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
              Set locations to see price
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
