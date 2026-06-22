import { Navigate, useParams } from 'react-router-dom';

/**
 * Bakåtkompatibilitet: gamla /avboka/:token-länkar i mejl
 * skickar nu kunden vidare till den fullständiga orderportalen,
 * där hen ser bokningen och kan avboka.
 */
export default function CancelBooking() {
  const { token } = useParams<{ token: string }>();
  if (!token) return <Navigate to="/" replace />;
  return <Navigate to={`/bestallning/${token}`} replace />;
}
