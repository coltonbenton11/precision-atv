export default function handler(req,res){res.status(200).json({ga4MeasurementId:process.env.GA4_MEASUREMENT_ID||''})}
