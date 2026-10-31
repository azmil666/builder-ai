import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next){
   const token = req.cookies.token;

   if(!token){
    return res.status(401).json({ error: "Access denied. No session token provided."});
   }

   const secret = process.env.JWT_SECRET;
   if (!secret || secret.trim().length === 0) {
    return res.status(500).json({ error: "Authentication system is not properly configured." });
   }

   try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next()
   } catch (error){
     res.status(401).json({ error: "Session expired or invalid. Please sign in again."});
   }
}
