
import { OANDA_CONFIG } from '../constants';
import { AssetSymbol, TradeType, OandaConfig } from '../types';

export class OandaService {
  private apiKey: string;
  private accountId: string;
  private baseUrl: string;

  constructor(config: OandaConfig) {
    this.apiKey = config.apiKey;
    this.accountId = config.accountId;
    this.baseUrl = OANDA_CONFIG.baseUrl;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  // Validates keys by fetching account summary
  async validateConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/summary`, {
        headers: this.getHeaders()
      });
      if (response.ok) {
        return true;
      }
      const err = await response.text();
      console.error("Oanda Validation Failed:", err);
      return false;
    } catch (error) {
      console.error('Oanda Network Error:', error);
      return false;
    }
  }

  // Fetch Real-Time Account Balance & Equity
  async getAccountSummary() {
    try {
      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/summary`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
          return null;
      }
      
      const data = await response.json();
      // Oanda returns strings for financial numbers
      return {
          balance: parseFloat(data.account.balance),
          nav: parseFloat(data.account.NAV), // Net Asset Value (Equity)
          marginAvailable: parseFloat(data.account.marginAvailable),
          currency: data.account.currency
      };
    } catch (error) {
      console.error('Oanda Account Network Error:', error);
      return null;
    }
  }

  async getPrices(instruments: AssetSymbol[]) {
    try {
      const oandaSymbols = instruments.map(s => OANDA_CONFIG.symbolMap[s]).join(',');
      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/pricing?instruments=${oandaSymbols}`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) throw new Error('Oanda API Error');
      
      const data = await response.json();
      return data.prices; // Array of price objects
    } catch (error) {
      // console.error('Oanda Price Fetch Error:', error); // Suppress frequent logs
      return null;
    }
  }

  async getOpenTrades() {
    try {
      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/openTrades`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.trades; // Returns array of Oanda Trade objects
    } catch (error) {
      console.error('Oanda Open Trades Error:', error);
      return [];
    }
  }

  async placeOrder(symbol: AssetSymbol, units: number, side: TradeType, stopLossPrice: number, takeProfitPrice: number) {
    try {
      const oandaSymbol = OANDA_CONFIG.symbolMap[symbol];
      // Oanda units: + for Buy, - for Sell. Must be a string.
      const adjustedUnits = side === TradeType.BUY ? Math.floor(units).toString() : (-Math.floor(units)).toString();

      // Format prices to correct precision (Oanda is strict)
      // XAU/USD uses 2 decimals. NAS100 uses 1 or 2 depending on broker settings, usually 1.
      const precision = symbol === AssetSymbol.NAS100 ? 1 : 2;

      const body: any = {
        order: {
          units: adjustedUnits,
          instrument: oandaSymbol,
          timeInForce: "FOK", // Fill or Kill
          type: "MARKET",
          positionFill: "DEFAULT",
          stopLossOnFill: { price: stopLossPrice.toFixed(precision) }
        }
      };

      // SAFETY NET: Attach Hard Take Profit if provided
      if (takeProfitPrice > 0) {
          body.order.takeProfitOnFill = { price: takeProfitPrice.toFixed(precision) };
      }

      console.log("Sending Order to Oanda:", JSON.stringify(body));

      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
          console.error("OANDA ORDER REJECTED:", JSON.stringify(data, null, 2));
          return null;
      }

      console.log("OANDA ORDER SUCCESS:", data);
      return data;
    } catch (error) {
      console.error('Oanda Order Network Error:', error);
      return null;
    }
  }

  // Close a trade partially or fully
  async closeTrade(tradeId: string, units: number) {
    try {
       // Ensure units is a string and positive for closure
       const unitsStr = Math.abs(Math.floor(units)).toString();
       
       const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/trades/${tradeId}/close`, {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({ units: unitsStr })
       });
       
       const data = await response.json();
       if (!response.ok) {
           console.error("OANDA CLOSE FAILED:", data);
           return false;
       }
       console.log(`OANDA CLOSED ${unitsStr} UNITS:`, data);
       return true;
    } catch (error) {
        console.error('Oanda Close Network Error:', error);
        return false;
    }
  }
}
