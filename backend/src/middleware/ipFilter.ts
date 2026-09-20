import { Request, Response, NextFunction } from 'express';
import ipaddr from 'ipaddr.js';

function parseIpList(list: string[]): { cidr: ipaddr.IPv4 | ipaddr.IPv6; prefixLength: number }[] {
  return list
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        if (entry.includes('/')) {
          const [ip, prefix] = entry.split('/');
          const parsed = ipaddr.parse(ip);
          return { cidr: parsed, prefixLength: parseInt(prefix, 10) };
        } else {
          const parsed = ipaddr.parse(entry);
          const prefixLength = parsed.kind() === 'ipv6' ? 128 : 32;
          return { cidr: parsed, prefixLength };
        }
      } catch {
        return null;
      }
    })
    .filter((v): v is { cidr: ipaddr.IPv4 | ipaddr.IPv6; prefixLength: number } => v !== null);
}

function ipMatches(clientIp: ipaddr.IPv4 | ipaddr.IPv6, rules: { cidr: ipaddr.IPv4 | ipaddr.IPv6; prefixLength: number }[]): boolean {
  return rules.some((rule) => {
    if (clientIp.kind() !== rule.cidr.kind()) return false;
    return clientIp.match(rule.cidr, rule.prefixLength);
  });
}

export function ipFilter(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.apiKey;
  if (!apiKey) {
    next();
    return;
  }

  const clientIpStr = req.ip || req.socket.remoteAddress || '';
  if (!clientIpStr) {
    next();
    return;
  }

  let clientIp: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    clientIp = ipaddr.parse(clientIpStr);
  } catch {
    next();
    return;
  }

  const blacklist = parseIpList(apiKey.ipBlacklist);
  if (blacklist.length > 0 && ipMatches(clientIp, blacklist)) {
    res.status(403).json({ error: 'IP address blocked', code: 'IP_BLACKLISTED' });
    return;
  }

  const whitelist = parseIpList(apiKey.ipWhitelist);
  if (whitelist.length > 0 && !ipMatches(clientIp, whitelist)) {
    res.status(403).json({ error: 'IP address not whitelisted', code: 'IP_NOT_WHITELISTED' });
    return;
  }

  next();
}